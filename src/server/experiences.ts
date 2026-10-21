import "server-only";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { techniqueCopy, type TechniqueId } from "@/content/techniques";
import { experienceSettingsSchema, type ExperienceSettings } from "@/lib/settings";
import { renderPreviewAudio } from "./audio/engine";
import { track } from "./analytics/events";
import { consumeCredit, findCreditFor, findProductAccess, FREE_TRIAL_MAX_MIN, listUsableCredits } from "./billing/entitlements";
import { db, schema } from "./db";
import { env } from "./env";
import { hit } from "./ratelimit";
import { buildContext, buildPreviewLines, screenUserInput, toSegments } from "./scenario";
import { ttsSpeed } from "./scenario/composer";
import { storage } from "./storage";
import { resolveVoice } from "./voices";

export class ExperienceError extends Error {
  constructor(
    readonly code:
      | "rate_limited"
      | "daily_limit"
      | "invalid_input"
      | "sensitive_support"
      | "not_found"
      | "needs_purchase"
      | "budget"
      | "generation_failed"
      | "forbidden",
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function sessionTitle(locale: string, settings: Pick<ExperienceSettings, "techniqueId" | "firstName">) {
  return `${techniqueCopy(locale, settings.techniqueId as TechniqueId).name} · ${settings.firstName}`;
}

/* ───────────────────────── Preview (anonymous allowed) ───────────────────────── */

export interface PreviewResult {
  draftId: string;
  audioId: string;
  transcript: string;
  durationMs: number;
  isDemo: boolean;
}

export async function createPreview(input: {
  settings: unknown;
  draftId?: string | null;
  anonId: string;
  userId?: string | null;
  uiLocale: string;
  ip: string;
  productId?: string | null;
  linesOverride?: string[];
}): Promise<PreviewResult> {
  const parsed = experienceSettingsSchema.safeParse(input.settings);
  if (!parsed.success) throw new ExperienceError("invalid_input", parsed.error.issues.map((i) => i.path.join(".")).join(","));
  const settings = parsed.data;

  const screen = screenUserInput([settings.intention, settings.favoritePlace, settings.desiredSituation, settings.gratitudeFocus, settings.event, settings.addressAs]);
  if (!screen.ok) {
    await db.insert(schema.moderationFlags).values({ entityType: "input", entityId: input.anonId, reason: screen.reason ?? "screen", details: { settings } });
    throw new ExperienceError(screen.reason === "sensitive" ? "sensitive_support" : "invalid_input", screen.reason);
  }

  // Abuse & cost protection for anonymous generation.
  const ipLimit = await hit(`preview:ip:${input.ip}`, env.PREVIEW_MAX_PER_IP_HOUR, 3600);
  if (!ipLimit.allowed) throw new ExperienceError("rate_limited");
  const who = input.userId ? `user:${input.userId}` : `anon:${input.anonId}`;
  const perVisitor = await hit(`preview:${who}`, input.userId ? env.PREVIEW_MAX_PER_ANON * 4 : env.PREVIEW_MAX_PER_ANON, 86400);
  if (!perVisitor.allowed) throw new ExperienceError("daily_limit");
  const global = await hit("preview:global", env.PREVIEW_GLOBAL_DAILY, 86400);
  if (!global.allowed) throw new ExperienceError("budget");

  const ctx = buildContext(settings);
  const preview = buildPreviewLines(ctx);
  const lines = input.linesOverride?.length ? input.linesOverride : preview.lines;
  const voice = await resolveVoice(settings.voicePresetId, settings.recordingLanguage);
  const text = lines.join(" ");

  await track("preview_requested", { anonId: input.anonId, userId: input.userId, techniqueId: settings.techniqueId, locale: input.uiLocale, productId: input.productId });

  // Draft = funnel state. Re-use the visitor's draft so settings are never lost.
  let draftId = input.draftId ?? null;
  if (draftId) {
    const [owned] = await db
      .select({ id: schema.experienceDrafts.id })
      .from(schema.experienceDrafts)
      .where(and(eq(schema.experienceDrafts.id, draftId), input.userId ? eq(schema.experienceDrafts.userId, input.userId) : eq(schema.experienceDrafts.anonId, input.anonId)));
    if (!owned) draftId = null;
  }
  if (draftId) {
    await db
      .update(schema.experienceDrafts)
      .set({ settings, techniqueId: settings.techniqueId, updatedAt: new Date(), previewCount: sql`${schema.experienceDrafts.previewCount} + 1` })
      .where(eq(schema.experienceDrafts.id, draftId));
  } else {
    const [d] = await db
      .insert(schema.experienceDrafts)
      .values({ anonId: input.anonId, userId: input.userId ?? null, techniqueId: settings.techniqueId, productId: input.productId ?? null, uiLocale: input.uiLocale, settings, previewCount: 1 })
      .returning();
    draftId = d.id;
  }

  const [scenario] = await db
    .insert(schema.audioScenarios)
    .values({
      ownerUserId: input.userId ?? null,
      anonId: input.anonId,
      productId: input.productId ?? null,
      draftId,
      techniqueId: settings.techniqueId,
      kind: "preview",
      language: settings.recordingLanguage,
      title: sessionTitle(input.uiLocale, settings),
      durationMin: 1,
      settings,
      source: input.linesOverride?.length ? "editor" : "composer",
      status: "validated",
      validation: preview.validation,
    })
    .returning();
  await db.insert(schema.audioSegments).values({
    scenarioId: scenario.id,
    idx: 0,
    phase: "arrival",
    segmentType: "opening",
    spokenText: text,
    language: settings.recordingLanguage,
    voiceId: voice.id,
    pauseBeforeMs: 600,
    pauseAfterMs: 1500,
    ambientTrackId: ctx.ambient,
    ambientVolume: ctx.ambient === "none" ? 0 : 22,
    speed: ttsSpeed(settings.narrationSpeed),
  });

  let rendered: Awaited<ReturnType<typeof renderPreviewAudio>>;
  try {
    rendered = await renderPreviewAudio({
      text,
      language: settings.recordingLanguage,
      speed: ttsSpeed(settings.narrationSpeed),
      voice: { providerVoiceId: voice.providerVoiceId, settings: (voice.settings as never) ?? undefined },
      ambient: ctx.ambient,
      usage: { purpose: "preview", userId: input.userId, anonId: input.anonId },
    });
  } catch (e) {
    if ((e as Error).message === "tts_budget_exceeded") throw new ExperienceError("budget");
    console.error("[preview] generation failed", e);
    throw new ExperienceError("generation_failed", (e as Error).message);
  }

  const storageKey = `audio/previews/${scenario.id}.mp3`;
  await storage().put(storageKey, rendered.audio, "audio/mpeg");
  const [audio] = await db
    .insert(schema.generatedAudio)
    .values({
      scenarioId: scenario.id,
      ownerUserId: input.userId ?? null,
      anonId: input.anonId,
      kind: "preview",
      storageKey,
      durationMs: rendered.durationMs,
      bytes: rendered.audio.length,
      ttsProvider: rendered.provider,
      isDemoAudio: rendered.isDemo,
      // Anonymous previews are working files: removed after 30 days unless claimed by an account.
      expiresAt: input.userId ? null : new Date(Date.now() + 30 * 86400_000),
    })
    .returning();
  await db.update(schema.experienceDrafts).set({ previewAudioId: audio.id }).where(eq(schema.experienceDrafts.id, draftId));
  if (input.userId) {
    await db
      .insert(schema.experienceLibrary)
      .values({ userId: input.userId, generatedAudioId: audio.id, title: scenario.title, techniqueId: settings.techniqueId, source: "preview", saved: false, productId: input.productId ?? null })
      .onConflictDoNothing();
  }
  await track("preview_generated", { anonId: input.anonId, userId: input.userId, techniqueId: settings.techniqueId, locale: input.uiLocale, productId: input.productId, props: { durationMs: rendered.durationMs, demo: rendered.isDemo } });

  return { draftId, audioId: audio.id, transcript: text, durationMs: rendered.durationMs, isDemo: rendered.isDemo };
}

/* ───────────────────────── Full experience (account required) ───────────────────────── */

export type FullRequestResult =
  | { status: "queued" | "running"; jobId: string }
  | { status: "ready"; jobId: string; audioId: string }
  | { status: "needs_purchase"; maxAvailableMin: number };

export async function requestFullExperience(input: {
  userId: string;
  draftId: string;
  durationMin?: number;
  regenerate?: boolean;
  programId?: string | null;
  programDay?: number | null;
}): Promise<FullRequestResult> {
  const [draft] = await db
    .select()
    .from(schema.experienceDrafts)
    .where(and(eq(schema.experienceDrafts.id, input.draftId), eq(schema.experienceDrafts.userId, input.userId)));
  if (!draft) throw new ExperienceError("not_found");
  const settings = experienceSettingsSchema.parse(draft.settings);

  // Idempotency: the same draft (and duration) never generates — or charges — twice unless asked to.
  const programId = input.programId ?? draft.programId;
  const programDay = input.programDay ?? draft.programDay;
  if (!input.regenerate) {
    const prefix = input.durationMin ? `full:${draft.id}:${input.durationMin}:` : `full:${draft.id}:`;
    const [existing] = await db
      .select()
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.userId, input.userId), sql`${schema.generationJobs.idempotencyKey} like ${prefix + "%"}`, inArray(schema.generationJobs.status, ["queued", "scripting", "synthesizing", "assembling", "completed"])))
      .orderBy(desc(schema.generationJobs.createdAt))
      .limit(1);
    if (existing?.status === "completed" && existing.generatedAudioId) return { status: "ready", jobId: existing.id, audioId: existing.generatedAudioId };
    if (existing) return { status: "running", jobId: existing.id };
  }

  // Product purchases are paid by the product entitlement, everything else by session credits.
  let entitlementId: string | null = null;
  let durationMin = Math.min(input.durationMin ?? settings.durationMin, 60);
  if (draft.productId) {
    const access = await findProductAccess(input.userId, draft.productId);
    if (!access) return { status: "needs_purchase", maxAvailableMin: 0 };
    durationMin = access.maxDurationMin;
    entitlementId = access.id;
  } else {
    const credits = await listUsableCredits(input.userId);
    const free = credits.find((c) => c.source === "free_trial");
    // The first free experience is generated from the pre-login settings, capped at 5 minutes.
    if (!input.durationMin && free && !credits.some((c) => c.source !== "free_trial" && c.maxDurationMin >= durationMin)) {
      durationMin = Math.min(durationMin, FREE_TRIAL_MAX_MIN);
    }
    const credit = await findCreditFor(input.userId, durationMin);
    if (!credit) {
      return { status: "needs_purchase", maxAvailableMin: credits.reduce((a, c) => Math.max(a, c.maxDurationMin), 0) };
    }
    entitlementId = credit.id;
  }

  const baseKey = `full:${draft.id}:${durationMin}:${programDay ?? 0}`;
  const idempotencyKey = input.regenerate ? `${baseKey}:r${Date.now()}` : baseKey;
  const title = sessionTitle(draft.uiLocale, settings);
  const job = await db.transaction(async (tx) => {
    if (draft.productId) {
      // product access: each generated session consumes one of the product's sessions
      const ok = await consumeCredit(entitlementId!, tx);
      if (!ok) throw new ExperienceError("needs_purchase");
    } else if (!(await consumeCredit(entitlementId!, tx))) {
      throw new ExperienceError("needs_purchase");
    }
    let templateId: string | null = null;
    let professionalId: string | null = null;
    if (draft.productId) {
      const [product] = await tx.select().from(schema.products).where(eq(schema.products.id, draft.productId));
      templateId = product?.templateId ?? null;
      professionalId = product?.professionalId ?? null;
      // Multi-day product: each day has its own approved template.
      if (product?.programId && programDay) {
        const [day] = await tx
          .select()
          .from(schema.programSessions)
          .where(and(eq(schema.programSessions.programId, product.programId), eq(schema.programSessions.dayIndex, programDay)));
        templateId = day?.templateId ?? templateId;
      }
      if (templateId) {
        const [tpl] = await tx.select({ durationMin: schema.experienceTemplates.durationMin }).from(schema.experienceTemplates).where(eq(schema.experienceTemplates.id, templateId));
        if (tpl) durationMin = tpl.durationMin;
      }
    }
    const [scenario] = await tx
      .insert(schema.audioScenarios)
      .values({
        ownerUserId: input.userId,
        professionalId,
        templateId,
        productId: draft.productId,
        draftId: draft.id,
        techniqueId: settings.techniqueId,
        kind: "full",
        language: settings.recordingLanguage,
        title,
        durationMin,
        settings,
        source: "composer",
        status: "draft",
        programId: programId ?? null,
        programDay: programDay ?? null,
      })
      .returning();
    const [job] = await tx
      .insert(schema.generationJobs)
      .values({ kind: "full", scenarioId: scenario.id, userId: input.userId, idempotencyKey, entitlementId })
      .onConflictDoNothing()
      .returning();
    if (!job) throw new ExperienceError("generation_failed", "duplicate");
    await tx.update(schema.experienceDrafts).set({ fullScenarioId: scenario.id }).where(eq(schema.experienceDrafts.id, draft.id));
    return job;
  });

  await track("full_generation_requested", { userId: input.userId, techniqueId: settings.techniqueId, productId: draft.productId, props: { durationMin, regenerate: !!input.regenerate } });
  kickWorker();
  return { status: "queued", jobId: job.id };
}

/** Process queued jobs in-process right after the response (dev / single node). The standalone worker does the same. */
export function kickWorker() {
  if (process.env.INLINE_WORKER === "false") return;
  try {
    after(async () => {
      const { runPendingJobs } = await import("./jobs/worker");
      await runPendingJobs({ maxJobs: 2, workerId: "inline" });
    });
  } catch {
    // outside a request scope — the standalone worker will pick the job up
  }
}

/* ───────────────────────── Access checks ───────────────────────── */

export async function getAudioForViewer(audioId: string, viewer: { userId?: string | null; anonId?: string | null }) {
  const conds = [viewer.userId ? eq(schema.generatedAudio.ownerUserId, viewer.userId) : undefined, viewer.anonId ? eq(schema.generatedAudio.anonId, viewer.anonId) : undefined].filter(Boolean);
  if (!conds.length) return null;
  const [row] = await db
    .select()
    .from(schema.generatedAudio)
    .where(and(eq(schema.generatedAudio.id, audioId), or(...conds), or(isNull(schema.generatedAudio.expiresAt), gte(schema.generatedAudio.expiresAt, new Date()))))
    .limit(1);
  return row ?? null;
}
