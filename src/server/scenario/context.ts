import { BREATH_PACES, EMOTIONS, GOALS, SETTINGS, findOption } from "@/content/options";
import { getTechnique, type AmbientId, type Category } from "@/content/techniques/registry";
import { defaultAddressForm } from "@/lib/names";
import type { ExperienceSettings } from "@/lib/settings";
import type { ContextItem, PersonalizationContext, RecordingLanguage } from "./types";

export interface StoredContextItem {
  kind: string;
  label: string;
  tone: string;
  allowedCategories: string[];
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Strip characters that could break TTS or prompt formatting. */
export function cleanUserText(v: string | undefined, max = 160): string | undefined {
  if (!v) return undefined;
  const t = v
    .replace(/[\u0000-\u001f\u007f<>{}[\]`\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[.!?;:,\s]+$/, "");
  return t || undefined;
}

/**
 * Decide which personal context may appear in this session.
 * Rules (privacy by design):
 *  - level "light": nothing beyond name + place
 *  - only kinds the technique permits (e.g. never in PMR or breathing)
 *  - only items the user explicitly allowed for this category
 *  - memories only when the user marked them positive — never assume a memory is pleasant
 *  - at most 1 item (balanced) or 2 items (deep) per session
 */
export function selectContextItems(
  items: StoredContextItem[],
  category: Category,
  allowedKinds: string[],
  level: PersonalizationContext["level"],
): ContextItem[] {
  if (level === "light") return [];
  const max = level === "deep" ? 2 : 1;
  return items
    .filter((i) => allowedKinds.includes(i.kind))
    .filter((i) => i.allowedCategories.includes(category))
    .filter((i) => (i.kind === "memory" ? i.tone === "positive" : i.tone !== "mixed"))
    .slice(0, max)
    .map((i) => ({ kind: i.kind as ContextItem["kind"], label: cleanUserText(i.label, 80)! }))
    .filter((i) => i.label);
}

export function buildContext(
  settings: ExperienceSettings,
  opts: { storedItems?: StoredContextItem[]; narratorInstructions?: string; durationMinOverride?: number } = {},
): PersonalizationContext {
  const technique = getTechnique(settings.techniqueId);
  if (!technique) throw new Error(`Unknown technique ${settings.techniqueId}`);
  const language = settings.recordingLanguage as RecordingLanguage;
  const curated = findOption(SETTINGS, settings.setting)?.spoken?.[language];
  const breath = BREATH_PACES.find((b) => b.id === (settings.breathPace ?? "gentle")) ?? BREATH_PACES[0];
  const level = settings.personalizationLevel;

  const ctx: PersonalizationContext = {
    technique,
    language,
    firstName: settings.firstName,
    address: cleanUserText(settings.addressAs, 40) ?? defaultAddressForm(settings.firstName, language),
    addressForm: settings.addressForm,
    durationMin: opts.durationMinOverride ?? settings.durationMin,
    style: settings.style,
    narrationSpeed: settings.narrationSpeed,
    pauseLevel: settings.pauseLevel,
    ambient: (settings.ambient ?? technique.defaultAmbient) as AmbientId,
    goal: findOption(GOALS, settings.goal)?.spoken?.[language],
    tensionAreas: settings.tensionAreas ?? [],
    intention: cleanUserText(settings.intention, 140),
    place: {
      curated,
      free: level === "light" ? undefined : cleanUserText(settings.favoritePlace, 100),
    },
    situation: cleanUserText(settings.desiredSituation ?? settings.event, 200),
    emotions: (settings.emotions ?? [])
      .map((e) => findOption(EMOTIONS, e)?.spoken?.[language])
      .filter((x): x is string => !!x),
    breath: { inhale: breath.inhale, exhale: breath.exhale },
    gratitudeFocus: cleanUserText(settings.gratitudeFocus, 120),
    contextItems: settings.useProfileContext
      ? selectContextItems(opts.storedItems ?? [], technique.category, technique.contextKinds, level)
      : [],
    level,
    narratorInstructions: cleanUserText(opts.narratorInstructions, 1200),
    seed: hashString(JSON.stringify(settings)),
  };
  return ctx;
}
