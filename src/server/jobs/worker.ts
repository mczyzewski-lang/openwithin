import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { experienceSettingsSchema } from "@/lib/settings";
import { assemble, fitPauses, synthesizeCached, withWorkdir, type TimelineSegment } from "../audio/engine";
import { getTtsProvider, TtsError } from "../audio/tts";
import { track } from "../analytics/events";
import { refundCredit } from "../billing/entitlements";
import { db, schema } from "../db";
import { buildContext, buildFullScenario, toSegments, type ScenarioSegment } from "../scenario";
import { personalizeTemplate } from "../studio/templates";
import { storage } from "../storage";
import { BudgetExceededError } from "../usage";
import { resolveVoice } from "../voices";

type Job = typeof schema.generationJobs.$inferSelect;

const STALE_LOCK_MS = 20 * 60_000;

/** Claim one due job with SKIP LOCKED so many workers can run safely in parallel. */
export async function claimJob(workerId: string): Promise<Job | null> {
  // Recover jobs whose worker died mid-way.
  await db
    .update(schema.generationJobs)
    .set({ status: "queued", lockedAt: null, lockedBy: null })
    .where(and(inArray(schema.generationJobs.status, ["scripting", "synthesizing", "assembling"]), lt(schema.generationJobs.lockedAt, new Date(Date.now() - STALE_LOCK_MS))));

  const rows = await db.execute<Job>(sql`
    update generation_jobs set status = 'scripting', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    where id = (
      select id from generation_jobs
      where status = 'queued' and run_after <= now()
      order by created_at
      for update skip locked
      limit 1
    )
    returning id`);
  const id = (rows as unknown as { id: string }[])[0]?.id;
  if (!id) return null;
  const [job] = await db.select().from(schema.generationJobs).where(eq(schema.generationJobs.id, id));
  return job ?? null;
}

async function setStatus(jobId: string, status: string, progress: number) {
  await db.update(schema.generationJobs).set({ status, progress, lockedAt: new Date() }).where(eq(schema.generationJobs.id, jobId));
}

/** Script the scenario if it has no segments yet (LLM → validate → composer fallback). */
async function ensureSegments(job: Job, scenario: typeof schema.audioScenarios.$inferSelect): Promise<ScenarioSegment[]> {
  const existing = await db.select().from(schema.audioSegments).where(eq(schema.audioSegments.scenarioId, scenario.id)).orderBy(asc(schema.audioSegments.idx));
  if (existing.length) {
    return existing.map((s) => ({
      segment_id: s.id,
      phase: s.phase as ScenarioSegment["phase"],
      segment_type: s.segmentType,
      spoken_text: s.spokenText,
      language: s.language as ScenarioSegment["language"],
      voice_id: s.voiceId,
      pause_before_ms: s.pauseBeforeMs,
      pause_after_ms: s.pauseAfterMs,
      pause_fixed: s.pauseFixed,
      ambient_track_id: (s.ambientTrackId ?? "none") as ScenarioSegment["ambient_track_id"],
      ambient_volume: s.ambientVolume,
      speed: s.speed,
    }));
  }
  const settings = experienceSettingsSchema.parse(scenario.settings);
  const storedItems = settings.useProfileContext && scenario.ownerUserId
    ? await db.select().from(schema.personalContextItems).where(eq(schema.personalContextItems.userId, scenario.ownerUserId))
    : [];
  let template: typeof schema.experienceTemplates.$inferSelect | undefined;
  if (scenario.templateId) [template] = await db.select().from(schema.experienceTemplates).where(eq(schema.experienceTemplates.id, scenario.templateId));

  const ctx = buildContext(
    { ...settings, voicePresetId: template?.voicePresetId ?? settings.voicePresetId, ambient: (template?.ambientTrackId as typeof settings.ambient) ?? settings.ambient },
    { storedItems, narratorInstructions: template?.narratorInstructions ?? undefined, durationMinOverride: scenario.durationMin },
  );
  const voice = await resolveVoice(template?.voicePresetId ?? settings.voicePresetId, ctx.language);
  const ambientVolume = template?.ambientVolume ?? 18;

  let segments: ScenarioSegment[];
  let source: "llm" | "composer" | "editor";
  let validation: unknown;
  if (template?.baseSegments) {
    // Studio product: the professional's approved script, personalised for this buyer.
    const personalised = personalizeTemplate(template.baseSegments as never, ctx);
    segments = toSegments(personalised.lines, ctx, voice.id, ambientVolume);
    source = "editor";
    validation = personalised.validation;
  } else {
    const built = await buildFullScenario(ctx, scenario.title);
    if (!built.validation.ok) throw new Error(`scenario_invalid:${built.validation.issues.map((i) => i.code).join(",")}`);
    segments = toSegments(built.lines, ctx, voice.id, ambientVolume);
    source = built.source;
    validation = { ...built.validation, llmError: built.llmError };
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.audioSegments).values(
      segments.map((s, idx) => ({
        id: s.segment_id,
        scenarioId: scenario.id,
        idx,
        phase: s.phase,
        segmentType: s.segment_type,
        spokenText: s.spoken_text,
        language: s.language,
        voiceId: s.voice_id,
        pauseBeforeMs: s.pause_before_ms,
        pauseAfterMs: s.pause_after_ms,
        pauseFixed: s.pause_fixed,
        ambientTrackId: s.ambient_track_id,
        ambientVolume: s.ambient_volume,
        speed: s.speed,
      })),
    );
    await tx.update(schema.audioScenarios).set({ status: "validated", source, validation, updatedAt: new Date() }).where(eq(schema.audioScenarios.id, scenario.id));
  });
  void job;
  return segments;
}

export async function processJob(job: Job): Promise<void> {
  const [scenario] = await db.select().from(schema.audioScenarios).where(eq(schema.audioScenarios.id, job.scenarioId));
  if (!scenario) throw new Error("scenario_missing");

  const segments = await ensureSegments(job, scenario);
  const chars = segments.reduce((a, s) => a + s.spoken_text.length, 0);
  await db.update(schema.generationJobs).set({ estimatedChars: chars }).where(eq(schema.generationJobs.id, job.id));
  await setStatus(job.id, "synthesizing", 10);

  const provider = getTtsProvider();
  const voices = new Map<string, Awaited<ReturnType<typeof resolveVoice>>>();
  const purpose = job.kind === "studio_sample" ? "studio_sample" : "full";

  const result = await withWorkdir(async (dir) => {
    const timeline: TimelineSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (!voices.has(s.voice_id)) voices.set(s.voice_id, await resolveVoice(s.voice_id, s.language));
      const voice = voices.get(s.voice_id)!;
      const seg = await synthesizeCached(
        provider,
        { text: s.spoken_text, providerVoiceId: voice.providerVoiceId, language: s.language, tier: "full", speed: s.speed, voiceSettings: (voice.settings as never) ?? undefined },
        dir,
        { purpose, userId: job.userId, jobId: job.id },
      );
      await db.update(schema.audioSegments).set({ cacheKey: seg.cacheKey, durationMs: seg.durationMs }).where(eq(schema.audioSegments.id, s.segment_id));
      timeline.push({ file: seg.file, durationMs: seg.durationMs, pauseBeforeMs: s.pause_before_ms, pauseAfterMs: s.pause_after_ms, pauseFixed: s.pause_fixed });
      if (i % 4 === 0) await setStatus(job.id, "synthesizing", 10 + Math.round((70 * (i + 1)) / segments.length));
    }
    await setStatus(job.id, "assembling", 85);
    const fitted = job.kind === "studio_sample" ? timeline : fitPauses(timeline, scenario.durationMin * 60_000);
    const out = path.join(dir, "session.mp3");
    const first = segments[0];
    const { durationMs } = await assemble({
      dir,
      segments: fitted,
      ambient: first.ambient_track_id,
      ambientVolume: first.ambient_volume,
      fadeOutMs: 8000,
      outFile: out,
    });
    return { audio: await readFile(out), durationMs };
  });

  const storageKey = `audio/${job.kind === "studio_sample" ? "samples" : "full"}/${scenario.id}/${job.id}.mp3`;
  await storage().put(storageKey, result.audio, "audio/mpeg");
  await db.transaction(async (tx) => {
    const [audio] = await tx
      .insert(schema.generatedAudio)
      .values({
        scenarioId: scenario.id,
        ownerUserId: scenario.ownerUserId,
        kind: job.kind === "studio_sample" ? "sample" : "full",
        storageKey,
        durationMs: result.durationMs,
        bytes: result.audio.length,
        ttsProvider: provider.id,
        isDemoAudio: provider.isDemo,
      })
      .returning();
    if (scenario.ownerUserId && job.kind === "full") {
      await tx
        .insert(schema.experienceLibrary)
        .values({
          userId: scenario.ownerUserId,
          generatedAudioId: audio.id,
          title: scenario.title,
          techniqueId: scenario.techniqueId,
          source: scenario.productId ? "purchase" : "generated",
          productId: scenario.productId,
          programId: scenario.programId,
          programDay: scenario.programDay,
        })
        .onConflictDoNothing();
    }
    await tx
      .update(schema.generationJobs)
      .set({ status: "completed", progress: 100, generatedAudioId: audio.id, finishedAt: new Date(), error: null })
      .where(eq(schema.generationJobs.id, job.id));
  });
  await track("full_generation_completed", { userId: job.userId, techniqueId: scenario.techniqueId, productId: scenario.productId, props: { durationMs: result.durationMs, chars, demo: provider.isDemo } });
}

export async function failOrRetry(job: Job, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const permanent =
    error instanceof BudgetExceededError ? false : error instanceof TtsError ? !error.retryable : message.startsWith("scenario_invalid");
  if (!permanent && job.attempts < job.maxAttempts) {
    const delay = 30_000 * 2 ** (job.attempts - 1);
    await db
      .update(schema.generationJobs)
      .set({ status: "queued", error: message.slice(0, 500), runAfter: new Date(Date.now() + delay), lockedAt: null, lockedBy: null })
      .where(eq(schema.generationJobs.id, job.id));
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.generationJobs).set({ status: "failed", error: message.slice(0, 500), finishedAt: new Date() }).where(eq(schema.generationJobs.id, job.id));
    // Never charge for a failed generation: give the credit back exactly once.
    if (job.entitlementId) {
      const updated = await tx
        .update(schema.generationJobs)
        .set({ creditRefunded: true })
        .where(and(eq(schema.generationJobs.id, job.id), eq(schema.generationJobs.creditRefunded, false)))
        .returning({ id: schema.generationJobs.id });
      if (updated.length) await refundCredit(job.entitlementId, tx);
    }
  });
  await track("full_generation_failed", { userId: job.userId, props: { error: message.slice(0, 200) } });
}

export async function runPendingJobs(opts: { maxJobs?: number; workerId?: string } = {}): Promise<number> {
  const workerId = opts.workerId ?? `worker-${process.pid}`;
  let processed = 0;
  while (processed < (opts.maxJobs ?? 1)) {
    const job = await claimJob(workerId);
    if (!job) break;
    try {
      await processJob(job);
    } catch (e) {
      console.error(`[worker] job ${job.id} failed (attempt ${job.attempts})`, e);
      await failOrRetry(job, e);
    }
    processed++;
  }
  return processed;
}

/** Remove expired anonymous previews (privacy: limited retention of working files). */
export async function cleanupExpired(): Promise<number> {
  const expired = await db.select().from(schema.generatedAudio).where(lt(schema.generatedAudio.expiresAt, new Date())).limit(500);
  if (!expired.length) return 0;
  await storage().remove(expired.map((e) => e.storageKey));
  await db.delete(schema.audioScenarios).where(inArray(schema.audioScenarios.id, expired.map((e) => e.scenarioId)));
  return expired.length;
}
