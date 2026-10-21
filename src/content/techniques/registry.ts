/**
 * Technique registry — single source of truth for every experience type.
 *
 * Each technique has its own session structure (ordered phases with time weights and
 * speech ratios), its own question set for the personalization form and its own safety
 * rules. Landing pages, the generator, the scenario composer, the LLM prompt and the
 * validator are all driven from this file. Adding a technique = adding an entry here,
 * landing copy in landing.<locale>.ts and (optionally) phrase banks.
 */

export type Category = "relaxation" | "meditation" | "visualization" | "sleep" | "growth";

export type PhaseType =
  | "arrival"
  | "breath_settle"
  | "breath_pattern"
  | "body_scan"
  | "pmr_group"
  | "intention"
  | "rotation"
  | "opposites"
  | "imagery_place"
  | "imagery_goal"
  | "imagery_confidence"
  | "future_self"
  | "safe_place"
  | "awareness"
  | "gratitude"
  | "energize"
  | "reflection"
  | "sleep_descent"
  | "integration"
  | "return"
  | "sleep_close";

export type QuestionId =
  | "goal"
  | "tension_areas"
  | "pace"
  | "intention"
  | "setting"
  | "favorite_place"
  | "desired_situation"
  | "emotions"
  | "sleep_sounds"
  | "breath_pace"
  | "gratitude_focus"
  | "event";

export type AmbientId = "none" | "rain" | "ocean" | "wind" | "soft_tones" | "night";

export type SafetyRule =
  | "no_medical_claims"
  | "allow_stop"
  | "no_long_breath_holds"
  | "gentle_tension"
  | "neutral_imagery_option"
  | "no_trauma_work"
  | "no_return_wake"
  | "eyes_open_option";

export interface PhaseSpec {
  phase: PhaseType;
  /** Relative share of the session's time. */
  weight: number;
  /** Fraction of the phase time that is spoken; the rest is real silence rendered by the audio engine. */
  speech: number;
  /** Required phases must be present for a scenario to pass validation. */
  required?: boolean;
}

export interface TechniqueDef {
  id: TechniqueId;
  category: Category;
  icon: string; // lucide icon name
  landing: boolean;
  durations: number[];
  defaultDuration: number;
  questions: QuestionId[];
  phases: PhaseSpec[];
  /** Which phases the 15-second preview draws from (opening of the real session). */
  previewPhases: PhaseType[];
  defaultAmbient: AmbientId;
  /** Sleep sessions fade out instead of waking the listener. */
  sleepEnding: boolean;
  safety: SafetyRule[];
  related: TechniqueId[];
  /** Which optional personal-context kinds may ever be used in this technique. */
  contextKinds: ("person" | "memory" | "motivation" | "aspiration" | "goal")[];
  popular?: boolean;
}

export const TECHNIQUE_IDS = [
  "yoga_nidra",
  "pmr",
  "body_scan",
  "deep_relaxation",
  "guided_breathing",
  "evening_relaxation",
  "mindfulness",
  "guided_meditation",
  "gratitude",
  "morning_meditation",
  "guided_visualization",
  "goal_visualization",
  "confidence_visualization",
  "future_self",
  "safe_place",
  "event_preparation",
  "sleep_meditation",
  "bedtime_relaxation",
  "sleep_body_scan",
  "sleep_imagery",
  "self_reflection",
  "motivation",
] as const;
export type TechniqueId = (typeof TECHNIQUE_IDS)[number];

const BASE_SAFETY: SafetyRule[] = ["no_medical_claims", "allow_stop", "no_trauma_work"];

export const TECHNIQUES: Record<TechniqueId, TechniqueDef> = {
  yoga_nidra: {
    id: "yoga_nidra",
    category: "meditation",
    icon: "Moon",
    landing: true,
    popular: true,
    durations: [10, 15, 20, 30, 45],
    defaultDuration: 20,
    questions: ["intention", "setting", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 1, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.45 },
      { phase: "intention", weight: 1, speech: 0.45, required: true },
      { phase: "rotation", weight: 3, speech: 0.6, required: true },
      { phase: "opposites", weight: 1.5, speech: 0.4 },
      { phase: "imagery_place", weight: 2, speech: 0.4 },
      { phase: "intention", weight: 0.6, speech: 0.45 },
      { phase: "return", weight: 0.9, speech: 0.6, required: true },
    ],
    previewPhases: ["arrival", "intention"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "neutral_imagery_option"],
    related: ["body_scan", "sleep_meditation", "deep_relaxation"],
    contextKinds: ["aspiration", "goal"],
  },
  pmr: {
    id: "pmr",
    category: "relaxation",
    icon: "Activity",
    landing: true,
    popular: true,
    durations: [5, 10, 15, 20, 30],
    defaultDuration: 15,
    questions: ["tension_areas", "pace", "goal"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 0.8, speech: 0.5 },
      { phase: "pmr_group", weight: 6, speech: 0.45, required: true },
      { phase: "integration", weight: 1, speech: 0.45 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "none",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "gentle_tension"],
    related: ["body_scan", "deep_relaxation", "bedtime_relaxation"],
    contextKinds: [],
  },
  body_scan: {
    id: "body_scan",
    category: "relaxation",
    icon: "ScanLine",
    landing: true,
    popular: true,
    durations: [5, 10, 15, 20, 30],
    defaultDuration: 15,
    questions: ["tension_areas", "pace", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "body_scan", weight: 6, speech: 0.45, required: true },
      { phase: "integration", weight: 1, speech: 0.45 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["pmr", "yoga_nidra", "sleep_body_scan"],
    contextKinds: [],
  },
  deep_relaxation: {
    id: "deep_relaxation",
    category: "relaxation",
    icon: "Waves",
    landing: true,
    durations: [5, 10, 15, 20, 30],
    defaultDuration: 15,
    questions: ["goal", "setting", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1.2, speech: 0.5 },
      { phase: "body_scan", weight: 2.5, speech: 0.45 },
      { phase: "imagery_place", weight: 2.5, speech: 0.4, required: true },
      { phase: "integration", weight: 1, speech: 0.4 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "imagery_place"],
    defaultAmbient: "ocean",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "neutral_imagery_option"],
    related: ["pmr", "body_scan", "safe_place"],
    contextKinds: ["memory"],
  },
  guided_breathing: {
    id: "guided_breathing",
    category: "relaxation",
    icon: "Wind",
    landing: true,
    popular: true,
    durations: [5, 10, 15],
    defaultDuration: 5,
    questions: ["breath_pace", "goal"],
    phases: [
      { phase: "arrival", weight: 0.7, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "breath_pattern", weight: 5, speech: 0.5, required: true },
      { phase: "integration", weight: 1, speech: 0.4 },
      { phase: "return", weight: 0.6, speech: 0.7, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "wind",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "no_long_breath_holds", "eyes_open_option"],
    related: ["mindfulness", "morning_meditation", "deep_relaxation"],
    contextKinds: [],
  },
  evening_relaxation: {
    id: "evening_relaxation",
    category: "relaxation",
    icon: "Sunset",
    landing: true,
    durations: [5, 10, 15, 20],
    defaultDuration: 10,
    questions: ["goal", "setting", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "reflection", weight: 1.2, speech: 0.45 },
      { phase: "body_scan", weight: 2.5, speech: 0.45, required: true },
      { phase: "imagery_place", weight: 1.5, speech: 0.4 },
      { phase: "return", weight: 0.7, speech: 0.6, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "rain",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["bedtime_relaxation", "sleep_meditation", "gratitude"],
    contextKinds: [],
  },
  mindfulness: {
    id: "mindfulness",
    category: "meditation",
    icon: "Circle",
    landing: true,
    popular: true,
    durations: [5, 10, 15, 20, 30],
    defaultDuration: 10,
    questions: ["goal", "pace"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 2, speech: 0.4, required: true },
      { phase: "awareness", weight: 4, speech: 0.35, required: true },
      { phase: "integration", weight: 1, speech: 0.4 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "none",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "eyes_open_option"],
    related: ["guided_meditation", "guided_breathing", "body_scan"],
    contextKinds: [],
  },
  guided_meditation: {
    id: "guided_meditation",
    category: "meditation",
    icon: "Sparkle",
    landing: true,
    popular: true,
    durations: [5, 10, 15, 20],
    defaultDuration: 10,
    questions: ["goal", "setting", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1.5, speech: 0.5, required: true },
      { phase: "body_scan", weight: 1.5, speech: 0.45 },
      { phase: "imagery_place", weight: 2, speech: 0.45 },
      { phase: "awareness", weight: 1.5, speech: 0.4 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["mindfulness", "guided_breathing", "morning_meditation"],
    contextKinds: [],
  },
  gratitude: {
    id: "gratitude",
    category: "meditation",
    icon: "Heart",
    landing: true,
    durations: [5, 10, 15],
    defaultDuration: 10,
    questions: ["gratitude_focus", "setting"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "gratitude", weight: 4, speech: 0.45, required: true },
      { phase: "integration", weight: 1, speech: 0.45 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "gratitude"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["evening_relaxation", "self_reflection", "mindfulness"],
    contextKinds: ["person", "memory", "motivation"],
  },
  morning_meditation: {
    id: "morning_meditation",
    category: "meditation",
    icon: "Sunrise",
    landing: true,
    durations: [5, 10, 15],
    defaultDuration: 10,
    questions: ["intention", "goal"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "intention", weight: 1.5, speech: 0.5, required: true },
      { phase: "energize", weight: 2.5, speech: 0.5, required: true },
      { phase: "return", weight: 0.7, speech: 0.7, required: true },
    ],
    previewPhases: ["arrival", "intention"],
    defaultAmbient: "wind",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "eyes_open_option"],
    related: ["guided_breathing", "goal_visualization", "motivation"],
    contextKinds: ["motivation", "aspiration", "goal"],
  },
  guided_visualization: {
    id: "guided_visualization",
    category: "visualization",
    icon: "Eye",
    landing: true,
    popular: true,
    durations: [5, 10, 15, 20],
    defaultDuration: 10,
    questions: ["setting", "favorite_place", "emotions"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "imagery_place", weight: 5, speech: 0.5, required: true },
      { phase: "integration", weight: 1, speech: 0.45 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "imagery_place"],
    defaultAmbient: "ocean",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "neutral_imagery_option"],
    related: ["safe_place", "goal_visualization", "deep_relaxation"],
    contextKinds: ["memory", "aspiration"],
  },
  goal_visualization: {
    id: "goal_visualization",
    category: "visualization",
    icon: "Target",
    landing: true,
    popular: true,
    durations: [5, 10, 15, 20],
    defaultDuration: 10,
    questions: ["desired_situation", "emotions", "setting"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "imagery_goal", weight: 4.5, speech: 0.5, required: true },
      { phase: "integration", weight: 1.2, speech: 0.5 },
      { phase: "return", weight: 0.7, speech: 0.7, required: true },
    ],
    previewPhases: ["arrival", "imagery_goal"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["future_self", "confidence_visualization", "motivation"],
    contextKinds: ["motivation", "aspiration", "goal", "person"],
  },
  confidence_visualization: {
    id: "confidence_visualization",
    category: "visualization",
    icon: "Sun",
    landing: true,
    durations: [5, 10, 15],
    defaultDuration: 10,
    questions: ["desired_situation", "emotions"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "imagery_confidence", weight: 4.5, speech: 0.5, required: true },
      { phase: "integration", weight: 1.2, speech: 0.5 },
      { phase: "return", weight: 0.7, speech: 0.7, required: true },
    ],
    previewPhases: ["arrival", "imagery_confidence"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["goal_visualization", "event_preparation", "future_self"],
    contextKinds: ["motivation", "aspiration", "goal"],
  },
  future_self: {
    id: "future_self",
    category: "visualization",
    icon: "Compass",
    landing: true,
    durations: [10, 15, 20],
    defaultDuration: 15,
    questions: ["desired_situation", "emotions", "setting"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "future_self", weight: 5, speech: 0.5, required: true },
      { phase: "integration", weight: 1.2, speech: 0.5 },
      { phase: "return", weight: 0.7, speech: 0.7, required: true },
    ],
    previewPhases: ["arrival", "future_self"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["goal_visualization", "self_reflection", "confidence_visualization"],
    contextKinds: ["motivation", "aspiration", "goal", "person"],
  },
  safe_place: {
    id: "safe_place",
    category: "visualization",
    icon: "Home",
    landing: true,
    durations: [5, 10, 15],
    defaultDuration: 10,
    questions: ["setting", "favorite_place", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "safe_place", weight: 5, speech: 0.45, required: true },
      { phase: "integration", weight: 1, speech: 0.45 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "safe_place"],
    defaultAmbient: "rain",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "neutral_imagery_option"],
    related: ["guided_visualization", "deep_relaxation", "sleep_imagery"],
    contextKinds: [],
  },
  event_preparation: {
    id: "event_preparation",
    category: "visualization",
    icon: "Flag",
    landing: false,
    durations: [5, 10, 15],
    defaultDuration: 10,
    questions: ["event", "emotions"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_pattern", weight: 1.5, speech: 0.5 },
      { phase: "imagery_confidence", weight: 4, speech: 0.5, required: true },
      { phase: "integration", weight: 1, speech: 0.5 },
      { phase: "return", weight: 0.7, speech: 0.7, required: true },
    ],
    previewPhases: ["arrival", "imagery_confidence"],
    defaultAmbient: "none",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "no_long_breath_holds"],
    related: ["confidence_visualization", "guided_breathing", "goal_visualization"],
    contextKinds: ["motivation", "goal"],
  },
  sleep_meditation: {
    id: "sleep_meditation",
    category: "sleep",
    icon: "MoonStar",
    landing: true,
    popular: true,
    durations: [10, 15, 20, 30, 45],
    defaultDuration: 20,
    questions: ["sleep_sounds", "setting", "pace"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.65, required: true },
      { phase: "breath_settle", weight: 1.5, speech: 0.4 },
      { phase: "body_scan", weight: 2.5, speech: 0.35 },
      { phase: "imagery_place", weight: 2, speech: 0.3 },
      { phase: "sleep_descent", weight: 2.5, speech: 0.25, required: true },
      { phase: "sleep_close", weight: 1, speech: 0.15, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "rain",
    sleepEnding: true,
    safety: [...BASE_SAFETY, "no_return_wake"],
    related: ["bedtime_relaxation", "yoga_nidra", "sleep_body_scan"],
    contextKinds: [],
  },
  bedtime_relaxation: {
    id: "bedtime_relaxation",
    category: "sleep",
    icon: "BedDouble",
    landing: true,
    durations: [10, 15, 20, 30],
    defaultDuration: 15,
    questions: ["tension_areas", "sleep_sounds", "pace"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.65, required: true },
      { phase: "breath_settle", weight: 1.2, speech: 0.45 },
      { phase: "pmr_group", weight: 3, speech: 0.4, required: true },
      { phase: "body_scan", weight: 2, speech: 0.35 },
      { phase: "sleep_descent", weight: 2, speech: 0.25, required: true },
      { phase: "sleep_close", weight: 1, speech: 0.15, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "night",
    sleepEnding: true,
    safety: [...BASE_SAFETY, "gentle_tension", "no_return_wake"],
    related: ["sleep_meditation", "pmr", "evening_relaxation"],
    contextKinds: [],
  },
  sleep_body_scan: {
    id: "sleep_body_scan",
    category: "sleep",
    icon: "ScanLine",
    landing: false,
    durations: [10, 15, 20, 30],
    defaultDuration: 20,
    questions: ["sleep_sounds", "pace"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.65, required: true },
      { phase: "breath_settle", weight: 1.2, speech: 0.4 },
      { phase: "body_scan", weight: 5, speech: 0.35, required: true },
      { phase: "sleep_descent", weight: 1.5, speech: 0.25 },
      { phase: "sleep_close", weight: 1, speech: 0.15, required: true },
    ],
    previewPhases: ["arrival", "breath_settle"],
    defaultAmbient: "night",
    sleepEnding: true,
    safety: [...BASE_SAFETY, "no_return_wake"],
    related: ["sleep_meditation", "body_scan", "bedtime_relaxation"],
    contextKinds: [],
  },
  sleep_imagery: {
    id: "sleep_imagery",
    category: "sleep",
    icon: "CloudMoon",
    landing: false,
    durations: [10, 15, 20, 30],
    defaultDuration: 20,
    questions: ["setting", "favorite_place", "sleep_sounds"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.65, required: true },
      { phase: "breath_settle", weight: 1.2, speech: 0.4 },
      { phase: "imagery_place", weight: 4.5, speech: 0.35, required: true },
      { phase: "sleep_descent", weight: 2, speech: 0.25 },
      { phase: "sleep_close", weight: 1, speech: 0.15, required: true },
    ],
    previewPhases: ["arrival", "imagery_place"],
    defaultAmbient: "ocean",
    sleepEnding: true,
    safety: [...BASE_SAFETY, "no_return_wake", "neutral_imagery_option"],
    related: ["sleep_meditation", "safe_place", "guided_visualization"],
    contextKinds: [],
  },
  self_reflection: {
    id: "self_reflection",
    category: "growth",
    icon: "Feather",
    landing: false,
    durations: [5, 10, 15],
    defaultDuration: 10,
    questions: ["goal", "emotions"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.7, required: true },
      { phase: "breath_settle", weight: 1, speech: 0.5 },
      { phase: "reflection", weight: 4.5, speech: 0.4, required: true },
      { phase: "integration", weight: 1.2, speech: 0.45 },
      { phase: "return", weight: 0.7, speech: 0.65, required: true },
    ],
    previewPhases: ["arrival", "reflection"],
    defaultAmbient: "soft_tones",
    sleepEnding: false,
    safety: [...BASE_SAFETY],
    related: ["gratitude", "future_self", "mindfulness"],
    contextKinds: ["motivation", "aspiration", "goal"],
  },
  motivation: {
    id: "motivation",
    category: "growth",
    icon: "Zap",
    landing: false,
    durations: [5, 10],
    defaultDuration: 5,
    questions: ["desired_situation", "emotions"],
    phases: [
      { phase: "arrival", weight: 0.8, speech: 0.75, required: true },
      { phase: "breath_pattern", weight: 1, speech: 0.5 },
      { phase: "imagery_goal", weight: 2.5, speech: 0.55, required: true },
      { phase: "energize", weight: 2, speech: 0.6 },
      { phase: "return", weight: 0.6, speech: 0.75, required: true },
    ],
    previewPhases: ["arrival", "imagery_goal"],
    defaultAmbient: "none",
    sleepEnding: false,
    safety: [...BASE_SAFETY, "no_long_breath_holds"],
    related: ["goal_visualization", "morning_meditation", "confidence_visualization"],
    contextKinds: ["motivation", "aspiration", "goal"],
  },
};

export function getTechnique(id: string): TechniqueDef | undefined {
  return (TECHNIQUES as Record<string, TechniqueDef>)[id];
}

export function isTechniqueId(id: string): id is TechniqueId {
  return id in TECHNIQUES;
}

export const CATEGORIES: Category[] = ["relaxation", "meditation", "visualization", "sleep", "growth"];

export function techniquesByCategory(category: Category): TechniqueDef[] {
  return TECHNIQUE_IDS.map((id) => TECHNIQUES[id]).filter((t) => t.category === category);
}

/** Mood shortcuts on the consumer dashboard → candidate techniques. */
export const MOODS = {
  relax: ["deep_relaxation", "pmr", "body_scan"],
  sleep: ["sleep_meditation", "bedtime_relaxation", "yoga_nidra"],
  focus: ["mindfulness", "guided_breathing", "morning_meditation"],
  visualize: ["goal_visualization", "guided_visualization", "future_self"],
  recharge: ["guided_breathing", "morning_meditation", "motivation"],
} as const satisfies Record<string, readonly TechniqueId[]>;
export type Mood = keyof typeof MOODS;
