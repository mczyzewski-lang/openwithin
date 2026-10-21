import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Default narrator presets. Ids are ElevenLabs premade voices that support the
 * multilingual models; verify availability in your ElevenLabs account and adjust
 * provider_voice_id in the voice_presets table (seeded by `npm run db:seed`).
 */
export const DEFAULT_VOICES = [
  { id: "lily", providerVoiceId: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", character: "soft", gender: "feminine", sort: 1 },
  { id: "sarah", providerVoiceId: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", character: "warm", gender: "feminine", sort: 2 },
  { id: "george", providerVoiceId: "JBFqnCBsd6RMkjVDRZzb", label: "George", character: "warm", gender: "masculine", sort: 3 },
  { id: "brian", providerVoiceId: "nPczCjzI2devNBz1zQrb", label: "Brian", character: "deep", gender: "masculine", sort: 4 },
  { id: "river", providerVoiceId: "SAz9YHcvj6GT2YYXdXww", label: "River", character: "calm", gender: "neutral", sort: 5 },
] as const;

export interface VoiceOption {
  id: string;
  label: string;
  character: string;
  gender: string | null;
}

export async function listVoices(language: string, professionalId?: string | null): Promise<VoiceOption[]> {
  const rows = await db
    .select()
    .from(schema.voicePresets)
    .where(eq(schema.voicePresets.isActive, true))
    .orderBy(asc(schema.voicePresets.sort));
  return rows
    .filter((v) => v.languages.includes(language))
    .filter((v) => !v.ownerProfessionalId || v.ownerProfessionalId === professionalId)
    .map((v) => ({ id: v.id, label: v.label, character: v.character, gender: v.gender }));
}

export async function resolveVoice(presetId: string | undefined | null, language: string) {
  const [preset] = presetId
    ? await db.select().from(schema.voicePresets).where(and(eq(schema.voicePresets.id, presetId), eq(schema.voicePresets.isActive, true))).limit(1)
    : [];
  if (preset && preset.languages.includes(language)) return preset;
  const [fallback] = await db
    .select()
    .from(schema.voicePresets)
    .where(and(eq(schema.voicePresets.isActive, true), isNull(schema.voicePresets.ownerProfessionalId)))
    .orderBy(asc(schema.voicePresets.sort))
    .limit(1);
  if (!fallback) throw new Error("No voice presets configured — run npm run db:seed");
  return fallback;
}
