import "server-only";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { MOODS, type Mood, type TechniqueId } from "@/content/techniques/registry";
import type { ExperienceSettings } from "@/lib/settings";
import { db, schema } from "./db";

export async function libraryItems(userId: string) {
  return db
    .select({ item: schema.experienceLibrary, audio: schema.generatedAudio })
    .from(schema.experienceLibrary)
    .innerJoin(schema.generatedAudio, eq(schema.generatedAudio.id, schema.experienceLibrary.generatedAudioId))
    .where(eq(schema.experienceLibrary.userId, userId))
    .orderBy(desc(schema.experienceLibrary.createdAt));
}

export async function continueListening(userId: string) {
  const [row] = await db
    .select({ item: schema.experienceLibrary, audio: schema.generatedAudio })
    .from(schema.experienceLibrary)
    .innerJoin(schema.generatedAudio, eq(schema.generatedAudio.id, schema.experienceLibrary.generatedAudioId))
    .where(and(eq(schema.experienceLibrary.userId, userId), gt(schema.experienceLibrary.lastPositionMs, 15_000), inArray(schema.generatedAudio.kind, ["full"])))
    .orderBy(desc(schema.experienceLibrary.lastPlayedAt))
    .limit(1);
  return row && row.item.lastPositionMs < row.audio.durationMs - 20_000 ? row : null;
}

/** Pick a technique for a mood: prefer one the user completed before, otherwise the first candidate. */
export async function pickTechniqueForMood(userId: string, mood: Mood): Promise<TechniqueId> {
  const candidates = MOODS[mood] as readonly TechniqueId[];
  const history = await db
    .select({ techniqueId: schema.experienceLibrary.techniqueId, completed: schema.experienceLibrary.completedCount })
    .from(schema.experienceLibrary)
    .where(eq(schema.experienceLibrary.userId, userId));
  const liked = history.filter((h) => h.completed > 0 && candidates.includes(h.techniqueId as TechniqueId)).sort((a, b) => b.completed - a.completed);
  return (liked[0]?.techniqueId as TechniqueId) ?? candidates[0];
}

/** Saved personalization → settings for a new session, so returning users never refill the form. */
export async function settingsFromProfile(userId: string, techniqueId: TechniqueId, uiLocale: string, durationMin?: number): Promise<ExperienceSettings | null> {
  const [p] = await db.select().from(schema.personalizationProfiles).where(eq(schema.personalizationProfiles.userId, userId));
  const [basic] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const firstName = p?.firstName ?? basic?.firstName;
  if (!firstName) return null;
  const [lastDraft] = await db
    .select()
    .from(schema.experienceDrafts)
    .where(and(eq(schema.experienceDrafts.userId, userId), eq(schema.experienceDrafts.techniqueId, techniqueId)))
    .orderBy(desc(schema.experienceDrafts.updatedAt))
    .limit(1);
  const previous = (lastDraft?.settings ?? {}) as Partial<ExperienceSettings>;
  return {
    ...previous,
    techniqueId,
    firstName,
    addressAs: p?.nameVocative ?? previous.addressAs,
    addressForm: previous.addressForm ?? "neutral",
    recordingLanguage: (p?.recordingLanguage ?? previous.recordingLanguage ?? (["en", "pl", "es"].includes(uiLocale) ? uiLocale : "en")) as ExperienceSettings["recordingLanguage"],
    voicePresetId: p?.voicePresetId ?? previous.voicePresetId,
    durationMin: durationMin ?? previous.durationMin ?? p?.defaultDurationMin ?? 10,
    style: (p?.style as ExperienceSettings["style"]) ?? previous.style ?? "gentle",
    narrationSpeed: (p?.narrationSpeed as ExperienceSettings["narrationSpeed"]) ?? "calm",
    pauseLevel: (p?.pauseLevel as ExperienceSettings["pauseLevel"]) ?? "balanced",
    favoritePlace: previous.favoritePlace ?? p?.favoritePlace ?? undefined,
    personalizationLevel: (p?.personalizationLevel as ExperienceSettings["personalizationLevel"]) ?? "balanced",
    useProfileContext: true,
  };
}

export async function createDraftFor(
  userId: string,
  settings: ExperienceSettings,
  uiLocale: string,
  opts: { productId?: string | null; programId?: string | null; programDay?: number | null } = {},
) {
  const [d] = await db
    .insert(schema.experienceDrafts)
    .values({ userId, techniqueId: settings.techniqueId, uiLocale, settings, productId: opts.productId ?? null, programId: opts.programId ?? null, programDay: opts.programDay ?? null })
    .returning();
  return d;
}
