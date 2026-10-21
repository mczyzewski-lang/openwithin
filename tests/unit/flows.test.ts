/**
 * Integration tests against a real Postgres (openwithin_test) and real FFmpeg, using the
 * clearly-labelled demo voice. Covers the critical paths end to end at the service level.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { DEFAULT_VOICES } from "@/server/voices";
import { SEED_OFFERS, SEED_PRICES } from "@/server/billing/pricing";
import { claimAnonymous, ensureUser } from "@/server/auth/session";
import { consumeCredit, creditSummary } from "@/server/billing/entitlements";
import { createPreview, ExperienceError, requestFullExperience } from "@/server/experiences";
import { failOrRetry, runPendingJobs } from "@/server/jobs/worker";
import { fulfillCheckout, startCheckout } from "@/server/billing/checkout";
import { afterPurchase, productPreviewLines } from "@/server/studio/products";
import { composeTemplate, createProduct, createProfessional, publishProduct, requestPayout } from "@/server/studio/service";
import { TtsError } from "@/server/audio/tts";
import { localStoragePath } from "@/server/storage";
import { probeDurationMs } from "@/server/audio/ffmpeg";

const settings = (extra: Record<string, unknown> = {}) => ({
  techniqueId: "body_scan",
  firstName: "Anna",
  recordingLanguage: "en",
  durationMin: 10,
  voicePresetId: "lily",
  ...extra,
});

beforeAll(async () => {
  for (const v of DEFAULT_VOICES) await db.insert(schema.voicePresets).values({ ...v, languages: ["en", "pl", "es"] }).onConflictDoNothing();
  for (const o of SEED_OFFERS) await db.insert(schema.offers).values({ ...o }).onConflictDoNothing();
  for (const p of SEED_PRICES) await db.insert(schema.offerPrices).values(p).onConflictDoNothing();
});

async function audioDuration(audioId: string) {
  const [a] = await db.select().from(schema.generatedAudio).where(eq(schema.generatedAudio.id, audioId));
  return probeDurationMs(localStoragePath(a.storageKey));
}

describe("B2C funnel", () => {
  const anonId = "anon-test-1";
  let draftId = "";
  let userId = "";

  it("generates a real ≤15 s personal preview without an account", async () => {
    const r = await createPreview({ settings: settings(), anonId, uiLocale: "en", ip: "10.0.0.1" });
    draftId = r.draftId;
    expect(r.transcript.split(/\s+/).slice(0, 3).join(" ")).toContain("Anna");
    expect(r.durationMs).toBeLessThanOrEqual(15_050);
    expect(await audioDuration(r.audioId)).toBeLessThanOrEqual(15_050);
  });

  it("rate-limits anonymous previews per visitor", async () => {
    const other = "anon-test-limit";
    for (let i = 0; i < 3; i++) await createPreview({ settings: settings(), anonId: other, uiLocale: "en", ip: `10.0.1.${i}` });
    await expect(createPreview({ settings: settings(), anonId: other, uiLocale: "en", ip: "10.0.1.9" })).rejects.toMatchObject({ code: "daily_limit" });
  });

  it("signing in keeps the draft, the preview and grants exactly one free session", async () => {
    const user = await ensureUser({ provider: "demo", subject: "anna@example.com", email: "anna@example.com" });
    await ensureUser({ provider: "demo", subject: "anna@example.com", email: "anna@example.com" });
    userId = user.id;
    await claimAnonymous(userId, anonId);
    const [draft] = await db.select().from(schema.experienceDrafts).where(eq(schema.experienceDrafts.id, draftId));
    expect(draft.userId).toBe(userId);
    const lib = await db.select().from(schema.experienceLibrary).where(eq(schema.experienceLibrary.userId, userId));
    expect(lib.map((l) => l.source)).toContain("preview");
    expect((await creditSummary(userId)).total).toBe(1);
  });

  it("generates the free 5-minute session from the pre-login settings in the background", async () => {
    const r = await requestFullExperience({ userId, draftId });
    expect(r.status).toBe("queued");
    await runPendingJobs({ maxJobs: 1, workerId: "test" });
    const again = await requestFullExperience({ userId, draftId });
    expect(again.status).toBe("ready");
    const ms = await audioDuration((again as { audioId: string }).audioId);
    expect(Math.abs(ms - 5 * 60_000)).toBeLessThan(10_000);
    expect((await creditSummary(userId)).total).toBe(0);
    const lib = await db.select().from(schema.experienceLibrary).where(and(eq(schema.experienceLibrary.userId, userId), eq(schema.experienceLibrary.source, "generated")));
    expect(lib).toHaveLength(1);
  }, 120_000);

  it("asks for a purchase when no credit covers the request", async () => {
    const r = await requestFullExperience({ userId, draftId, durationMin: 30 });
    expect(r.status).toBe("needs_purchase");
  });

  it("checkout fulfilment is idempotent (no double grant)", async () => {
    const { checkoutId } = await startCheckout({
      userId, email: null, locale: "en", kind: "offer", offerId: "pack_5", currency: "usd", amountMinor: 1999, title: "Pack", successPath: "/en/space", cancelPath: "/en/space",
    });
    const a = await fulfillCheckout({ checkoutId });
    const b = await fulfillCheckout({ checkoutId });
    expect(a?.alreadyFulfilled).toBe(false);
    expect(b?.alreadyFulfilled).toBe(true);
    expect((await creditSummary(userId)).total).toBe(5);
    const purchases = await db.select().from(schema.purchases).where(eq(schema.purchases.userId, userId));
    expect(purchases).toHaveLength(1);
  });

  it("a credit can never be consumed twice concurrently", async () => {
    const [ent] = await db.insert(schema.entitlements).values({ userId, source: "grant", kind: "session_credits", creditsTotal: 1, maxDurationMin: 10 }).returning();
    const results = await Promise.all([consumeCredit(ent.id), consumeCredit(ent.id), consumeCredit(ent.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("a permanently failed generation refunds the credit exactly once and keeps the settings", async () => {
    const [ent] = await db.insert(schema.entitlements).values({ userId, source: "grant", kind: "session_credits", creditsTotal: 1, creditsUsed: 1, maxDurationMin: 10 }).returning();
    const [scenario] = await db.insert(schema.audioScenarios).values({ ownerUserId: userId, techniqueId: "body_scan", kind: "full", language: "en", title: "t", durationMin: 5, settings: settings(), source: "composer" }).returning();
    const [job] = await db.insert(schema.generationJobs).values({ kind: "full", scenarioId: scenario.id, userId, idempotencyKey: `fail-${scenario.id}`, entitlementId: ent.id, attempts: 3 }).returning();
    await failOrRetry(job, new TtsError("provider down", false));
    await failOrRetry(job, new TtsError("provider down", false));
    const [after] = await db.select().from(schema.entitlements).where(eq(schema.entitlements.id, ent.id));
    expect(after.creditsUsed).toBe(0);
    const [draft] = await db.select().from(schema.experienceDrafts).where(eq(schema.experienceDrafts.id, draftId));
    expect(draft.settings).toBeTruthy();
  });
});

describe("Studio → Store → personalized delivery", () => {
  it("a professional creates, prices and publishes a product; a buyer receives a personalised session", async () => {
    const proUser = await ensureUser({ provider: "demo", subject: "pro@example.com", email: "pro@example.com" });
    const pro = await createProfessional(proUser.id, { displayName: "Anna Kowalska", slug: "anna-kowalska", profession: "psychologist", acceptTerms: true });
    expect(pro.clinicalMode).toBe(true);
    await expect(createProfessional(proUser.id, { displayName: "X", slug: "studio", profession: "coach", acceptTerms: true })).rejects.toThrow();

    const template = await composeTemplate(pro.id, { title: "Deep relaxation", techniqueId: "deep_relaxation", language: "pl", durationMin: 10, ambient: "ocean", ambientVolume: 18, pauseLevel: "balanced", style: "gentle" });
    const base = template.baseSegments as { text: string }[];
    expect(base[0].text).toContain("{{name}}");

    const product = await createProduct(pro, {
      title: "7 dni głębokiej relaksacji", description: "Program relaksacyjny przygotowany przez psycholog, personalizowany imieniem.", type: "single",
      templateIds: [template.id], isFree: false, visibility: "public", personalizationFields: ["setting"], prices: { pln: 79 },
    });
    expect(await publishProduct(pro, product.id)).toBe("published");

    const buyerSettings = { techniqueId: "deep_relaxation", firstName: "Marek", recordingLanguage: "pl", durationMin: 10, setting: "lake" };
    const lines = await productPreviewLines(product.id, buyerSettings);
    expect(lines?.[0]).toContain("Marku");

    const buyer = await ensureUser({ provider: "demo", subject: "marek@example.com", email: "marek@example.com" });
    const preview = await createPreview({ settings: buyerSettings, anonId: "anon-buyer", userId: buyer.id, uiLocale: "pl", ip: "10.0.2.1", productId: product.id, linesOverride: lines });
    const { checkoutId } = await startCheckout({
      userId: buyer.id, email: null, locale: "pl", kind: "product", productId: product.id, draftId: preview.draftId, currency: "pln", amountMinor: 7900, title: product.title, successPath: "/pl/space", cancelPath: "/pl/space",
    });
    await fulfillCheckout({ checkoutId });
    await afterPurchase(checkoutId);

    const [commission] = await db.select().from(schema.platformCommissions).where(eq(schema.platformCommissions.professionalId, pro.id));
    expect(commission).toMatchObject({ rateBps: 3000, platformMinor: 2370, authorMinor: 5530 });

    const [job] = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.userId, buyer.id));
    expect(job.status).toBe("queued");
    await runPendingJobs({ maxJobs: 1, workerId: "test" });
    const [scenario] = await db.select().from(schema.audioScenarios).where(eq(schema.audioScenarios.id, job.scenarioId));
    expect(scenario.templateId).toBe(template.id);
    const segs = await db.select().from(schema.audioSegments).where(eq(schema.audioSegments.scenarioId, scenario.id));
    const text = segs.map((s) => s.spokenText).join(" ");
    expect(text).toContain("Marku");
    expect(text).not.toContain("{{");
    const lib = await db.select().from(schema.experienceLibrary).where(eq(schema.experienceLibrary.userId, buyer.id));
    expect(lib.some((l) => l.source === "purchase" && l.productId === product.id)).toBe(true);

    const payout = await requestPayout(pro, "pln");
    expect(payout).toMatchObject({ status: "held", holdReason: "payouts_disabled_by_platform", amountMinor: 5530 });
  }, 180_000);
});

void ExperienceError;
