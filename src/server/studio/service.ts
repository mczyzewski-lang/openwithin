import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getTechnique, type PhaseType } from "@/content/techniques/registry";
import { RESERVED_SEGMENTS } from "@/lib/constants";
import { landingEntries } from "@/content/techniques";
import { track } from "../analytics/events";
import { db, schema } from "../db";
import { env, features } from "../env";
import { kickWorker } from "../experiences";
import { randomToken } from "../crypto";
import { stripe } from "../billing/stripe";
import { buildFullScenario } from "../scenario";
import { buildContext } from "../scenario/context";
import { ttsSpeed } from "../scenario/composer";
import { validateScenario } from "../scenario/validate";
import { resolveVoice } from "../voices";
import { fillTemplateText, planToBase, type BaseSegment } from "./templates";

export class StudioError extends Error {}

export const PROFESSIONS = ["psychologist", "psychotherapist", "coach", "yoga_teacher", "mindfulness_trainer", "wellness", "performance_coach"] as const;
const CLINICAL = new Set(["psychologist", "psychotherapist"]);

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isSlugAllowed(slug: string): boolean {
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return false;
  if ((RESERVED_SEGMENTS as readonly string[]).includes(slug) || ["en", "pl", "es", "de", "fr", "it", "pt"].includes(slug)) return false;
  return !landingEntries().some((e) => e.slug === slug || e.copy.aliases?.includes(slug));
}

/* ───────────── professional accounts ───────────── */

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(60),
  profession: z.enum(PROFESSIONS),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(1500).optional(),
  credentials: z.string().trim().max(300).optional(),
  website: z.string().trim().url().max(200).optional().or(z.literal("")),
  acceptTerms: z.literal(true),
});

export async function createProfessional(userId: string, input: z.infer<typeof onboardingSchema>) {
  const slug = slugify(input.slug);
  if (!isSlugAllowed(slug)) throw new StudioError("slug_unavailable");
  const [taken] = await db.select({ id: schema.professionalProfiles.id }).from(schema.professionalProfiles).where(eq(schema.professionalProfiles.slug, slug));
  if (taken) throw new StudioError("slug_unavailable");
  const [pro] = await db
    .insert(schema.professionalProfiles)
    .values({
      userId,
      displayName: input.displayName,
      slug,
      profession: input.profession,
      headline: input.headline || null,
      bio: input.bio || null,
      credentials: input.credentials || null,
      website: input.website || null,
      clinicalMode: CLINICAL.has(input.profession),
    })
    .returning();
  await db.insert(schema.professionalStores).values({ professionalId: pro.id }).onConflictDoNothing();
  await db.insert(schema.consents).values({ userId, kind: "professional_terms", version: "2026-10", granted: true });
  return pro;
}

/* ───────────── templates (scenario authoring) ───────────── */

export const templateInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  techniqueId: z.string(),
  language: z.enum(["en", "pl", "es"]),
  durationMin: z.coerce.number().int().min(3).max(60),
  voicePresetId: z.string().max(64).optional(),
  ambient: z.enum(["none", "rain", "ocean", "wind", "soft_tones", "night"]).default("none"),
  ambientVolume: z.coerce.number().int().min(0).max(60).default(18),
  pauseLevel: z.enum(["short", "balanced", "spacious"]).default("balanced"),
  style: z.enum(["gentle", "grounded", "poetic", "minimal"]).default("gentle"),
  narratorInstructions: z.string().max(1200).optional(),
});

/**
 * Compose a base script with placeholders ({{name}}, {{place}}, …) so each buyer later
 * receives a personalised instance of the professional's approved scenario.
 */
export async function composeTemplate(proId: string, input: z.infer<typeof templateInputSchema>) {
  const technique = getTechnique(input.techniqueId);
  if (!technique) throw new StudioError("invalid_technique");
  const ctx = buildContext(
    {
      techniqueId: technique.id,
      firstName: "Name",
      addressAs: "{{name}}",
      addressForm: "neutral",
      recordingLanguage: input.language,
      voicePresetId: input.voicePresetId,
      durationMin: input.durationMin,
      style: input.style,
      narrationSpeed: "calm",
      pauseLevel: input.pauseLevel,
      ambient: input.ambient,
      favoritePlace: "{{place}}",
      intention: "{{intention}}",
      desiredSituation: "{{situation}}",
      personalizationLevel: "balanced",
      useProfileContext: false,
    },
    { narratorInstructions: input.narratorInstructions },
  );
  // cleanUserText strips braces from free text — restore the placeholders explicitly.
  ctx.address = "{{name}}";
  ctx.place = { free: "{{place}}" };
  ctx.intention = "{{intention}}";
  ctx.situation = "{{situation}}";
  const built = await buildFullScenario(ctx, input.title);
  const base = planToBase(built.lines);
  const [template] = await db
    .insert(schema.experienceTemplates)
    .values({
      techniqueId: technique.id,
      professionalId: proId,
      title: input.title,
      language: input.language,
      durationMin: input.durationMin,
      narratorInstructions: input.narratorInstructions || null,
      voicePresetId: input.voicePresetId || null,
      ambientTrackId: input.ambient,
      ambientVolume: input.ambientVolume,
      pauseLevel: input.pauseLevel,
      baseSegments: base,
    })
    .returning();
  return template;
}

const segmentSchema = z.object({
  phase: z.string(),
  type: z.string().max(40),
  text: z.string().trim().min(1).max(420),
  pause_after_ms: z.coerce.number().int().min(0).max(120_000),
  pause_fixed: z.boolean().optional(),
});

/** Validate a template the way a buyer's instance would be validated (placeholders filled with samples). */
export function validateTemplate(templateRow: typeof schema.experienceTemplates.$inferSelect, base: BaseSegment[]) {
  const technique = getTechnique(templateRow.techniqueId)!;
  const sample = { name: "Alex", place: "a quiet beach", intention: "I am calm", goal: "rest", situation: "a calm morning" };
  const lines = base.map((s) => ({ phase: s.phase, type: s.type, text: fillTemplateText(s.text, sample) })).filter((l) => l.text);
  const result = validateScenario(lines, { technique, language: templateRow.language as "en", address: "Alex", durationMin: templateRow.durationMin });
  const issues = [...result.issues];
  if (!base[0]?.text.includes("{{name}}")) issues.push({ code: "name_missing", severity: "warning" });
  return { ok: result.ok, issues };
}

export async function saveTemplateSegments(proId: string, templateId: string, raw: unknown) {
  const segments = z.array(segmentSchema).min(1).max(400).parse(raw);
  const [tpl] = await db.select().from(schema.experienceTemplates).where(and(eq(schema.experienceTemplates.id, templateId), eq(schema.experienceTemplates.professionalId, proId)));
  if (!tpl) throw new StudioError("not_found");
  const technique = getTechnique(tpl.techniqueId)!;
  const allowed = new Set(technique.phases.map((p) => p.phase));
  const base: BaseSegment[] = segments.map((s) => ({ ...s, phase: (allowed.has(s.phase as PhaseType) ? s.phase : technique.phases[0].phase) as PhaseType }));
  const validation = validateTemplate(tpl, base);
  await db.update(schema.experienceTemplates).set({ baseSegments: base, updatedAt: new Date() }).where(eq(schema.experienceTemplates.id, templateId));
  return validation;
}

/** Render the first ~45 seconds of a template with a sample name so the author can hear it. */
export async function requestStudioSample(pro: typeof schema.professionalProfiles.$inferSelect, templateId: string, sampleName: string) {
  const [tpl] = await db.select().from(schema.experienceTemplates).where(and(eq(schema.experienceTemplates.id, templateId), eq(schema.experienceTemplates.professionalId, pro.id)));
  if (!tpl?.baseSegments) throw new StudioError("not_found");
  // Generator usage is part of the Studio plan: Starter 15 samples / 30 days, Pro 150.
  const since = new Date(Date.now() - 30 * 86400_000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.generationJobs)
    .innerJoin(schema.audioScenarios, eq(schema.audioScenarios.id, schema.generationJobs.scenarioId))
    .where(and(eq(schema.generationJobs.kind, "studio_sample"), eq(schema.audioScenarios.professionalId, pro.id), gte(schema.generationJobs.createdAt, since)));
  if (count >= (pro.plan === "pro" ? 150 : 15)) throw new StudioError("sample_quota");

  const base = tpl.baseSegments as BaseSegment[];
  const voice = await resolveVoice(tpl.voicePresetId, tpl.language);
  const values = { name: sampleName, place: tpl.language === "pl" ? "spokojna plaża" : tpl.language === "es" ? "una playa tranquila" : "a quiet beach", intention: "", goal: "", situation: "" };
  let elapsed = 0;
  const lines = [];
  for (const s of base) {
    const text = fillTemplateText(s.text, values);
    if (!text) continue;
    lines.push({ ...s, text, pause: Math.min(s.pause_after_ms, 6000) });
    elapsed += text.split(/\s+/).length * 450 + Math.min(s.pause_after_ms, 6000);
    if (elapsed > 45_000) break;
  }
  const [scenario] = await db
    .insert(schema.audioScenarios)
    .values({
      ownerUserId: pro.userId,
      professionalId: pro.id,
      templateId: tpl.id,
      techniqueId: tpl.techniqueId,
      kind: "sample",
      language: tpl.language,
      title: `${tpl.title} · sample`,
      durationMin: 1,
      settings: { sampleName },
      source: "editor",
      status: "validated",
    })
    .returning();
  await db.insert(schema.audioSegments).values(
    lines.map((l, idx) => ({
      scenarioId: scenario.id,
      idx,
      phase: l.phase,
      segmentType: l.type,
      spokenText: l.text,
      language: tpl.language,
      voiceId: voice.id,
      pauseBeforeMs: idx === 0 ? 800 : 0,
      pauseAfterMs: l.pause,
      pauseFixed: true,
      ambientTrackId: tpl.ambientTrackId ?? "none",
      ambientVolume: tpl.ambientTrackId && tpl.ambientTrackId !== "none" ? tpl.ambientVolume : 0,
      speed: ttsSpeed("calm"),
    })),
  );
  const [job] = await db
    .insert(schema.generationJobs)
    .values({ kind: "studio_sample", scenarioId: scenario.id, userId: pro.userId, idempotencyKey: `sample:${scenario.id}` })
    .returning();
  await track("studio_sample_generated", { userId: pro.userId, professionalId: pro.id });
  kickWorker();
  return job;
}

/* ───────────── products ───────────── */

export const productInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().min(20).max(3000),
  type: z.enum(["single", "program"]),
  templateIds: z.array(z.string().uuid()).min(1).max(30),
  isFree: z.boolean().default(false),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  personalizationFields: z.array(z.enum(["setting", "favorite_place", "intention", "desired_situation", "emotions", "tension_areas", "sleep_sounds", "goal"])).max(4).default([]),
  prices: z.object({ pln: z.coerce.number().min(0).max(100000).optional(), eur: z.coerce.number().min(0).max(100000).optional(), usd: z.coerce.number().min(0).max(100000).optional() }),
});

export async function createProduct(pro: typeof schema.professionalProfiles.$inferSelect, input: z.infer<typeof productInputSchema>) {
  const templates = await db
    .select()
    .from(schema.experienceTemplates)
    .where(and(inArray(schema.experienceTemplates.id, input.templateIds), eq(schema.experienceTemplates.professionalId, pro.id)));
  if (templates.length !== new Set(input.templateIds).size) throw new StudioError("invalid_templates");
  const ordered = input.templateIds.map((id) => templates.find((t) => t.id === id)!);
  const first = ordered[0];
  const slug = slugify(input.slug || input.title) || randomToken(4).toLowerCase();

  return db.transaction(async (tx) => {
    let programId: string | null = null;
    if (input.type === "program") {
      const [program] = await tx
        .insert(schema.programs)
        .values({ professionalId: pro.id, title: input.title, description: input.description, language: first.language, days: ordered.length })
        .returning();
      programId = program.id;
      await tx.insert(schema.programSessions).values(
        ordered.map((t, i) => ({ programId: program.id, dayIndex: i + 1, techniqueId: t.techniqueId, title: t.title, durationMin: t.durationMin, templateId: t.id })),
      );
    }
    const [product] = await tx
      .insert(schema.products)
      .values({
        professionalId: pro.id,
        slug,
        type: input.type,
        title: input.title,
        description: input.description,
        language: first.language,
        techniqueId: first.techniqueId,
        templateId: first.id,
        programId,
        durationMin: Math.max(...ordered.map((t) => t.durationMin)),
        sessionsCount: ordered.length,
        personalizationFields: input.personalizationFields,
        isFree: input.isFree,
        visibility: input.visibility,
      })
      .returning();
    for (const [currency, amount] of Object.entries(input.prices)) {
      if (amount === undefined || input.isFree) continue;
      if (amount > 0) await tx.insert(schema.productVariants).values({ productId: product.id, currency, amountMinor: Math.round(amount * 100) });
    }
    return product;
  });
}

/**
 * Publication workflow. The author confirms professional responsibility; every session
 * template is screened by the same validator as consumer scripts. Clean products go live,
 * anything flagged goes to the moderation queue (pending_review).
 */
export async function publishProduct(pro: typeof schema.professionalProfiles.$inferSelect, productId: string) {
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.professionalId, pro.id)));
  if (!product) throw new StudioError("not_found");
  if (!product.isFree) {
    const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, product.id));
    if (!variants.length) throw new StudioError("price_required");
  }
  const templateIds = product.programId
    ? (await db.select({ id: schema.programSessions.templateId }).from(schema.programSessions).where(eq(schema.programSessions.programId, product.programId))).map((r) => r.id!).filter(Boolean)
    : [product.templateId!];
  const templates = await db.select().from(schema.experienceTemplates).where(inArray(schema.experienceTemplates.id, templateIds));
  const problems = templates.flatMap((t) => validateTemplate(t, (t.baseSegments as BaseSegment[]) ?? []).issues.filter((i) => i.severity === "error").map((i) => ({ template: t.id, ...i })));
  const status = problems.length ? "pending_review" : "published";
  await db
    .update(schema.products)
    .set({ status, responsibilityAckAt: new Date(), publishedAt: status === "published" ? new Date() : null, reviewNotes: problems.length ? JSON.stringify(problems) : null, updatedAt: new Date() })
    .where(eq(schema.products.id, product.id));
  if (problems.length) await db.insert(schema.moderationFlags).values({ entityType: "product", entityId: product.id, reason: "validator", details: problems });
  else await track("studio_product_published", { userId: pro.userId, professionalId: pro.id, productId: product.id });
  return status;
}

export async function createShareLink(pro: typeof schema.professionalProfiles.$inferSelect, productId: string, note: string | null, maxUses: number) {
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.professionalId, pro.id)));
  if (!product) throw new StudioError("not_found");
  const [link] = await db
    .insert(schema.shareLinks)
    .values({ professionalId: pro.id, productId, token: randomToken(16), note, maxUses: Math.min(100, Math.max(1, maxUses)), expiresAt: new Date(Date.now() + 60 * 86400_000) })
    .returning();
  return link;
}

/* ───────────── payouts (Stripe Connect) ───────────── */

export async function startConnectOnboarding(pro: typeof schema.professionalProfiles.$inferSelect, email: string | null, returnUrl: string) {
  if (!features.stripe) throw new StudioError("payments_not_configured");
  const [store] = await db.select().from(schema.professionalStores).where(eq(schema.professionalStores.professionalId, pro.id));
  let accountId = store?.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      email: email ?? undefined,
      business_profile: { name: pro.displayName, product_description: "Personalized guided audio programmes" },
      capabilities: { transfers: { requested: true } },
      metadata: { professional_id: pro.id },
    });
    accountId = account.id;
    await db.update(schema.professionalStores).set({ stripeAccountId: accountId, stripeOnboardingStatus: "pending" }).where(eq(schema.professionalStores.professionalId, pro.id));
  }
  const link = await stripe().accountLinks.create({ account: accountId, refresh_url: returnUrl, return_url: returnUrl, type: "account_onboarding" });
  return link.url;
}

export async function payoutSummary(proId: string) {
  const rows = await db
    .select({ currency: schema.platformCommissions.currency, status: schema.platformCommissions.status, author: sql<number>`sum(${schema.platformCommissions.authorMinor})::int` })
    .from(schema.platformCommissions)
    .where(eq(schema.platformCommissions.professionalId, proId))
    .groupBy(schema.platformCommissions.currency, schema.platformCommissions.status);
  return rows;
}

/**
 * Creates a payout from accrued commissions. Real transfers are only made when
 * MARKETPLACE_PAYOUTS_ENABLED=true AND the connected account has payouts enabled;
 * otherwise the payout is recorded as `held` with the reason.
 */
export async function requestPayout(pro: typeof schema.professionalProfiles.$inferSelect, currency: string) {
  const [store] = await db.select().from(schema.professionalStores).where(eq(schema.professionalStores.professionalId, pro.id));
  return db.transaction(async (tx) => {
    const accrued = await tx
      .select()
      .from(schema.platformCommissions)
      .where(and(eq(schema.platformCommissions.professionalId, pro.id), eq(schema.platformCommissions.currency, currency), eq(schema.platformCommissions.status, "accrued")))
      .for("update");
    const amount = accrued.reduce((a, c) => a + c.authorMinor, 0);
    if (amount <= 0) throw new StudioError("nothing_to_pay");
    const canTransfer = env.MARKETPLACE_PAYOUTS_ENABLED && features.stripe && !!store?.stripeAccountId && store.payoutsEnabled;
    const holdReason = canTransfer ? null : !env.MARKETPLACE_PAYOUTS_ENABLED ? "payouts_disabled_by_platform" : !store?.stripeAccountId ? "no_connected_account" : "connected_account_not_ready";
    const [payout] = await tx.insert(schema.payouts).values({ professionalId: pro.id, amountMinor: amount, currency, status: canTransfer ? "pending" : "held", holdReason }).returning();
    await tx.update(schema.platformCommissions).set({ status: "in_payout", payoutId: payout.id }).where(inArray(schema.platformCommissions.id, accrued.map((a) => a.id)));
    if (canTransfer) {
      const transfer = await stripe().transfers.create({ amount, currency, destination: store!.stripeAccountId!, metadata: { payout_id: payout.id } }, { idempotencyKey: `payout_${payout.id}` });
      await tx.update(schema.payouts).set({ status: "paid", providerTransferId: transfer.id }).where(eq(schema.payouts.id, payout.id));
      await tx.update(schema.platformCommissions).set({ status: "paid_out" }).where(eq(schema.platformCommissions.payoutId, payout.id));
    }
    return payout;
  });
}

/* ───────────── analytics (aggregated only) ───────────── */

export async function studioAnalytics(proId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const events = await db
    .select({ name: schema.analyticsEvents.name, count: sql<number>`count(*)::int` })
    .from(schema.analyticsEvents)
    .where(and(eq(schema.analyticsEvents.professionalId, proId), gte(schema.analyticsEvents.createdAt, since)))
    .groupBy(schema.analyticsEvents.name);
  const count = (n: string) => events.find((e) => e.name === n)?.count ?? 0;
  const revenue = await db
    .select({ currency: schema.purchases.currency, total: sql<number>`sum(${schema.purchases.amountGrossMinor})::int`, n: sql<number>`count(*)::int` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.professionalId, proId), eq(schema.purchases.status, "paid"), gte(schema.purchases.createdAt, since)))
    .groupBy(schema.purchases.currency);
  const repeatBuyers = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from (
      select user_id from purchases where professional_id = ${proId} and status = 'paid' group by user_id having count(*) > 1
    ) x`);
  const visits = count("product_view");
  const purchases = revenue.reduce((a, r) => a + r.n, 0);
  return {
    visits,
    previewPlays: count("product_preview_played") + count("preview_generated"),
    checkoutStarts: count("checkout_started"),
    purchases,
    conversion: visits ? purchases / visits : 0,
    revenue,
    repeatBuyers: (repeatBuyers as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

export async function proOverview(proId: string) {
  const products = await db.select().from(schema.products).where(eq(schema.products.professionalId, proId)).orderBy(desc(schema.products.createdAt));
  const templates = await db.select().from(schema.experienceTemplates).where(eq(schema.experienceTemplates.professionalId, proId)).orderBy(desc(schema.experienceTemplates.updatedAt));
  const sales = await db
    .select({ currency: schema.purchases.currency, total: sql<number>`coalesce(sum(${schema.purchases.amountGrossMinor}),0)::int`, n: sql<number>`count(*)::int` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.professionalId, proId), eq(schema.purchases.status, "paid")))
    .groupBy(schema.purchases.currency);
  const payouts = await payoutSummary(proId);
  return { products, templates, sales, payouts };
}

export async function templatesForPro(proId: string) {
  return db.select().from(schema.experienceTemplates).where(eq(schema.experienceTemplates.professionalId, proId)).orderBy(asc(schema.experienceTemplates.createdAt));
}
