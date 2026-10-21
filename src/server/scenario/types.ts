import type { PlaceForms } from "@/content/options";
import type { AmbientId, PhaseType, TechniqueDef } from "@/content/techniques/registry";

export type RecordingLanguage = "en" | "pl" | "es";

/** A single spoken unit of a scenario. Mirrors the audio_segments table. */
export interface ScenarioSegment {
  segment_id: string;
  phase: PhaseType;
  segment_type: string;
  spoken_text: string;
  language: RecordingLanguage;
  voice_id: string;
  pause_before_ms: number;
  pause_after_ms: number;
  /** Fixed pauses (breath counts, tension holds) are never rescaled by the assembler. */
  pause_fixed: boolean;
  ambient_track_id: AmbientId;
  ambient_volume: number; // 0–100
  speed: number; // percent of natural speech rate
}

export interface Scenario {
  title: string;
  technique_id: string;
  language: RecordingLanguage;
  duration_min: number;
  voice_id: string;
  ambient_track_id: AmbientId;
  ambient_volume: number;
  sleep_ending: boolean;
  source: "llm" | "composer" | "editor";
  segments: ScenarioSegment[];
}

/** What a phase generator emits before voice/ambient metadata is attached. */
export interface DraftLine {
  phase: PhaseType;
  type: string;
  text: string;
  /** Relative share of the phase's silence placed after this line. */
  pauseWeight?: number;
  /** Exact pause after this line (breath counts, tension holds). */
  fixedPauseMs?: number;
}

export interface ContextItem {
  kind: "person" | "memory" | "motivation" | "aspiration" | "goal";
  label: string;
}

/** Everything the composer / LLM is allowed to use for one session — already filtered. */
export interface PersonalizationContext {
  technique: TechniqueDef;
  language: RecordingLanguage;
  firstName: string;
  address: string;
  addressForm: "feminine" | "masculine" | "neutral";
  durationMin: number;
  style: "gentle" | "grounded" | "poetic" | "minimal";
  narrationSpeed: "slow" | "calm" | "natural";
  pauseLevel: "short" | "balanced" | "spacious";
  ambient: AmbientId;
  goal?: string;
  tensionAreas: string[];
  intention?: string;
  place?: { curated?: PlaceForms; free?: string };
  situation?: string;
  emotions: string[];
  breath: { inhale: number; exhale: number };
  gratitudeFocus?: string;
  contextItems: ContextItem[];
  level: "light" | "balanced" | "deep";
  /** Narrator instructions from a professional template (Studio). */
  narratorInstructions?: string;
  /** Seed for deterministic variation (same settings → same script → TTS cache hits). */
  seed: number;
}
