import "server-only";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import type { AmbientId } from "@/content/techniques/registry";
import { db, schema } from "../db";
import { storage } from "../storage";
import { assertTtsBudget, recordUsage } from "../usage";
import { ambientGain, ambientSource } from "./ambient";
import { ffmpeg, probeDurationMs } from "./ffmpeg";
import { getTtsProvider, ttsCacheKey, type TtsProvider, type TtsRequest } from "./tts";

export const PREVIEW_CAP_MS = 15_000;

export interface UsageContext {
  purpose: "preview" | "full" | "studio_sample";
  userId?: string | null;
  anonId?: string | null;
  jobId?: string | null;
}

export async function withWorkdir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ow-job-"));
  try {
    return await fn(dir);
  } finally {
    // Working files are always removed — only the final mix is kept.
    await rm(dir, { recursive: true, force: true });
  }
}

/** Synthesize one segment, reusing the segment cache when the exact same audio exists. */
export async function synthesizeCached(
  provider: TtsProvider,
  req: TtsRequest,
  dir: string,
  usage: UsageContext,
): Promise<{ file: string; durationMs: number; cached: boolean; cacheKey: string }> {
  const cacheKey = ttsCacheKey(provider, req);
  const file = path.join(dir, `${cacheKey}.mp3`);
  const storageKey = `tts-cache/${cacheKey.slice(0, 2)}/${cacheKey}.mp3`;
  const [hit] = await db.select().from(schema.ttsCache).where(eq(schema.ttsCache.cacheKey, cacheKey)).limit(1);
  if (hit) {
    try {
      await writeFile(file, await storage().get(hit.storageKey));
      await db.update(schema.ttsCache).set({ lastUsedAt: new Date() }).where(eq(schema.ttsCache.cacheKey, cacheKey));
      await recordUsage({ provider: provider.id, purpose: usage.purpose, units: req.text.length, cached: true, userId: usage.userId, anonId: usage.anonId, jobId: usage.jobId });
      return { file, durationMs: hit.durationMs, cached: true, cacheKey };
    } catch {
      // cache entry without object — fall through and regenerate
    }
  }
  if (!provider.isDemo) await assertTtsBudget(req.text.length);
  const audio = await provider.synthesize(req);
  await writeFile(file, audio);
  const durationMs = await probeDurationMs(file);
  await storage().put(storageKey, audio, "audio/mpeg");
  await db
    .insert(schema.ttsCache)
    .values({ cacheKey, storageKey, durationMs, chars: req.text.length, provider: provider.id })
    .onConflictDoUpdate({ target: schema.ttsCache.cacheKey, set: { lastUsedAt: sql`now()` } });
  await recordUsage({
    provider: provider.id,
    purpose: usage.purpose,
    units: req.text.length,
    estCostMicrousd: provider.costMicrousd(req.text.length, req.tier),
    userId: usage.userId,
    anonId: usage.anonId,
    jobId: usage.jobId,
  });
  return { file, durationMs, cached: false, cacheKey };
}

export interface TimelineSegment {
  file: string;
  durationMs: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  pauseFixed: boolean;
}

/**
 * Fit flexible pauses so the session lands on its target duration using the *measured*
 * speech durations. Fixed pauses (breath counts, tension holds) are never changed.
 */
export function fitPauses(segments: TimelineSegment[], targetMs: number): TimelineSegment[] {
  const speech = segments.reduce((a, s) => a + s.durationMs + s.pauseBeforeMs, 0);
  const fixed = segments.filter((s) => s.pauseFixed).reduce((a, s) => a + s.pauseAfterMs, 0);
  const flexible = segments.filter((s) => !s.pauseFixed).reduce((a, s) => a + s.pauseAfterMs, 0);
  if (flexible <= 0) return segments;
  const factor = Math.min(2.5, Math.max(0.45, (targetMs - speech - fixed) / flexible));
  return segments.map((s) => (s.pauseFixed ? s : { ...s, pauseAfterMs: Math.max(600, Math.round(s.pauseAfterMs * factor)) }));
}

/**
 * Assemble voice segments, real silences and the ambient bed into one normalized MP3.
 * Silence is rendered by FFmpeg (apad / adelay), never by punctuation in the text.
 */
export async function assemble(opts: {
  dir: string;
  segments: TimelineSegment[];
  ambient: AmbientId;
  ambientVolume: number;
  capMs?: number;
  fadeOutMs?: number;
  outFile: string;
}): Promise<{ durationMs: number }> {
  const { dir, segments } = opts;
  const totalMs = segments.reduce((a, s) => a + s.pauseBeforeMs + s.durationMs + s.pauseAfterMs, 0);
  const finalMs = opts.capMs ? Math.min(opts.capMs, totalMs) : totalMs;
  const fadeOut = Math.min(opts.fadeOutMs ?? 6000, finalMs / 4);

  const inputs: string[] = [];
  const filters: string[] = [];
  segments.forEach((s, i) => {
    inputs.push("-i", s.file);
    filters.push(
      `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,adelay=${Math.max(0, s.pauseBeforeMs)}:all=1,apad=pad_dur=${(s.pauseAfterMs / 1000).toFixed(3)}[s${i}]`,
    );
  });
  filters.push(`${segments.map((_, i) => `[s${i}]`).join("")}concat=n=${segments.length}:v=0:a=1[voice]`);

  const amb = ambientSource(opts.ambient, finalMs / 1000 + 1);
  if (amb && opts.ambientVolume > 0) {
    const gain = ambientGain(opts.ambientVolume);
    filters.push(`${amb},aformat=sample_fmts=fltp:channel_layouts=mono,volume=${gain.toFixed(3)},afade=t=in:d=4[amb]`);
    filters.push(`[voice]asplit=2[v1][v2]`);
    // Duck the ambient bed gently under the voice.
    filters.push(`[amb][v2]sidechaincompress=threshold=0.04:ratio=3:attack=30:release=900[ambd]`);
    filters.push(`[v1][ambd]amix=inputs=2:duration=first:normalize=0[mix]`);
  } else {
    filters.push(`[voice]anull[mix]`);
  }
  const fadeStart = Math.max(0, (finalMs - fadeOut) / 1000);
  filters.push(
    `[mix]atrim=0:${(finalMs / 1000).toFixed(3)},afade=t=out:st=${fadeStart.toFixed(3)}:d=${(fadeOut / 1000).toFixed(3)},loudnorm=I=-19:TP=-2:LRA=11,aresample=44100[out]`,
  );

  const script = path.join(dir, "filter.txt");
  await writeFile(script, filters.join(";\n"));
  await ffmpeg([...inputs, "-filter_complex_script", script, "-map", "[out]", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", opts.outFile], 20 * 60_000);
  return { durationMs: await probeDurationMs(opts.outFile) };
}

export interface VoiceSpec {
  providerVoiceId: string;
  settings?: TtsRequest["voiceSettings"];
}

/** Fast, cheap preview pipeline: one TTS call + one FFmpeg pass, hard-capped at 15 s. */
export async function renderPreviewAudio(opts: {
  text: string;
  language: string;
  speed: number;
  voice: VoiceSpec;
  ambient: AmbientId;
  usage: UsageContext;
}): Promise<{ audio: Buffer; durationMs: number; isDemo: boolean; provider: string }> {
  const provider = getTtsProvider();
  return withWorkdir(async (dir) => {
    const seg = await synthesizeCached(
      provider,
      { text: opts.text, providerVoiceId: opts.voice.providerVoiceId, language: opts.language, tier: "preview", speed: opts.speed, voiceSettings: opts.voice.settings },
      dir,
      opts.usage,
    );
    const out = path.join(dir, "preview.mp3");
    const tail = Math.max(800, Math.min(2000, PREVIEW_CAP_MS - 600 - seg.durationMs));
    const { durationMs } = await assemble({
      dir,
      segments: [{ file: seg.file, durationMs: seg.durationMs, pauseBeforeMs: 600, pauseAfterMs: tail, pauseFixed: true }],
      ambient: opts.ambient,
      ambientVolume: opts.ambient === "none" ? 0 : 22,
      capMs: PREVIEW_CAP_MS,
      fadeOutMs: 1500,
      outFile: out,
    });
    return { audio: await readFile(out), durationMs, isDemo: provider.isDemo, provider: provider.id };
  });
}
