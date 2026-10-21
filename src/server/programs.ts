import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getSystemProgram } from "@/content/programs";
import type { ExperienceSettings } from "@/lib/settings";
import { track } from "./analytics/events";
import { db, schema } from "./db";

export async function programWithSessions(programId: string) {
  const [program] = await db.select().from(schema.programs).where(eq(schema.programs.id, programId));
  if (!program) return null;
  const sessions = await db.select().from(schema.programSessions).where(eq(schema.programSessions.programId, programId)).orderBy(asc(schema.programSessions.dayIndex));
  return { program, sessions };
}

export async function programByKey(key: string) {
  const [program] = await db.select().from(schema.programs).where(eq(schema.programs.key, key));
  return program ? programWithSessions(program.id) : null;
}

export async function startProgram(userId: string, programId: string, productId?: string | null) {
  const [row] = await db
    .insert(schema.programProgress)
    .values({ userId, programId, productId: productId ?? null })
    .onConflictDoNothing()
    .returning();
  if (row) await track("program_started", { userId, props: { programId } });
  const [progress] = await db.select().from(schema.programProgress).where(and(eq(schema.programProgress.userId, userId), eq(schema.programProgress.programId, programId)));
  return progress;
}

/** A completed listen of day N advances the programme. No streaks, no penalties for missed days. */
export async function markProgramProgress(userId: string, programId: string, day: number) {
  const data = await programWithSessions(programId);
  if (!data) return;
  const [progress] = await db.select().from(schema.programProgress).where(and(eq(schema.programProgress.userId, userId), eq(schema.programProgress.programId, programId)));
  if (!progress || progress.completedDays.includes(day)) return;
  const completed = [...progress.completedDays, day].sort((a, b) => a - b);
  const next = Math.min(data.program.days, Math.max(...completed) + 1);
  await db
    .update(schema.programProgress)
    .set({
      completedDays: completed,
      currentDay: next,
      lastSessionAt: new Date(),
      completedAt: completed.length >= data.program.days ? new Date() : null,
    })
    .where(eq(schema.programProgress.id, progress.id));
  await track("program_day_completed", { userId, props: { programId, day } });
}

export async function activePrograms(userId: string) {
  const rows = await db
    .select({ progress: schema.programProgress, program: schema.programs })
    .from(schema.programProgress)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programProgress.programId))
    .where(eq(schema.programProgress.userId, userId));
  return rows;
}

/** Build the settings for a programme day from the user's saved personalization profile. */
export async function settingsForProgramDay(userId: string, programId: string, day: number, uiLocale: string): Promise<ExperienceSettings | null> {
  const data = await programWithSessions(programId);
  const session = data?.sessions.find((s) => s.dayIndex === day);
  if (!data || !session) return null;
  const [profile] = await db.select().from(schema.personalizationProfiles).where(eq(schema.personalizationProfiles.userId, userId));
  const [basic] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const firstName = profile?.firstName ?? basic?.firstName;
  if (!firstName) return null;
  const language = (profile?.recordingLanguage ?? (["en", "pl", "es"].includes(uiLocale) ? uiLocale : "en")) as ExperienceSettings["recordingLanguage"];
  const sys = data.program.key ? getSystemProgram(data.program.key) : undefined;
  void sys;
  return {
    techniqueId: session.techniqueId as ExperienceSettings["techniqueId"],
    firstName,
    addressAs: profile?.nameVocative ?? undefined,
    addressForm: "neutral",
    recordingLanguage: language,
    voicePresetId: profile?.voicePresetId ?? undefined,
    durationMin: session.durationMin,
    style: (profile?.style as ExperienceSettings["style"]) ?? "gentle",
    narrationSpeed: (profile?.narrationSpeed as ExperienceSettings["narrationSpeed"]) ?? "calm",
    pauseLevel: (profile?.pauseLevel as ExperienceSettings["pauseLevel"]) ?? "balanced",
    ambient: (profile?.ambientTrackId as ExperienceSettings["ambient"]) ?? undefined,
    setting: undefined,
    favoritePlace: profile?.favoritePlace ?? undefined,
    personalizationLevel: (profile?.personalizationLevel as ExperienceSettings["personalizationLevel"]) ?? "balanced",
    useProfileContext: true,
  };
}
