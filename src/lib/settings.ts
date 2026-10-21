import { z } from "zod";
import { TECHNIQUE_IDS } from "@/content/techniques/registry";

const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : undefined))
    .optional();

/**
 * Everything the personalization form collects. Shared by client and server.
 * All fields except technique, first name and language are optional.
 */
export const experienceSettingsSchema = z.object({
  techniqueId: z.enum(TECHNIQUE_IDS),
  firstName: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[\p{L}][\p{L}\p{M}' .-]*$/u, "invalid_name"),
  /** Form of address actually spoken (e.g. Polish vocative "Marku"). Defaults from firstName. */
  addressAs: shortText(40),
  /** Optional grammatical form for gendered languages. Neutral phrasing is used when absent. */
  addressForm: z.enum(["feminine", "masculine", "neutral"]).default("neutral"),
  recordingLanguage: z.enum(["en", "pl", "es"]),
  voicePresetId: z.string().max(64).optional(),
  durationMin: z.coerce.number().int().min(3).max(60),
  style: z.enum(["gentle", "grounded", "poetic", "minimal"]).default("gentle"),
  narrationSpeed: z.enum(["slow", "calm", "natural"]).default("calm"),
  pauseLevel: z.enum(["short", "balanced", "spacious"]).default("balanced"),
  ambient: z.enum(["none", "rain", "ocean", "wind", "soft_tones", "night"]).optional(),
  // Technique-specific answers
  goal: z.string().max(40).optional(),
  tensionAreas: z.array(z.string().max(40)).max(6).optional(),
  intention: shortText(140),
  setting: z.string().max(40).optional(),
  favoritePlace: shortText(140),
  desiredSituation: shortText(240),
  emotions: z.array(z.string().max(40)).max(3).optional(),
  breathPace: z.enum(["gentle", "even", "slow"]).optional(),
  gratitudeFocus: shortText(140),
  event: shortText(160),
  // Personalization controls
  personalizationLevel: z.enum(["light", "balanced", "deep"]).default("balanced"),
  /** Use saved personal context items allowed for this category (signed-in users only). */
  useProfileContext: z.boolean().default(false),
});

export type ExperienceSettings = z.infer<typeof experienceSettingsSchema>;
export type ExperienceSettingsInput = z.input<typeof experienceSettingsSchema>;
