/**
 * Scenario validation: technique compliance, language, safety and cost rules.
 * Every scenario (LLM, composer or Studio editor) passes through here before audio is generated.
 */
import type { PhaseType, TechniqueDef } from "@/content/techniques/registry";
import type { DraftLine, RecordingLanguage } from "./types";

export interface ValidationIssue {
  code:
    | "missing_phase"
    | "phase_order"
    | "language_mismatch"
    | "medical_claim"
    | "unsafe_technique"
    | "breath_hold"
    | "wake_in_sleep"
    | "name_overuse"
    | "name_missing"
    | "segment_too_long"
    | "too_many_chars"
    | "empty";
  detail?: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  chars: number;
}

const STOPWORDS: Record<RecordingLanguage, string[]> = {
  en: ["the", "and", "your", "you", "of", "to", "a", "in", "is", "with", "let", "now", "this"],
  pl: ["i", "w", "na", "się", "nie", "to", "z", "do", "jest", "teraz", "pozwól", "ciało", "oddech", "że", "by"],
  es: ["el", "la", "y", "de", "que", "en", "tu", "los", "las", "con", "por", "ahora", "se", "deja"],
};

/** Medical / therapeutic promises and techniques that require specialist guidance. */
const BLOCKED: Record<RecordingLanguage, { re: RegExp; code: ValidationIssue["code"] }[]> = {
  en: [
    { re: /\b(cure[sd]?|curing|heal(s|ed|ing)? (your|the) (anxiety|depression|insomnia|trauma|illness)|treat(s|ment)? (your|of)? ?(anxiety|depression|insomnia|disorder))\b/i, code: "medical_claim" },
    { re: /\b(guarantee[sd]?|clinically proven|rewire your (brain|neurons)|reprogram your (mind|subconscious))\b/i, code: "medical_claim" },
    { re: /\b(diagnos\w*|therapy session|psychotherapy|medication)\b/i, code: "medical_claim" },
    { re: /\b(trauma|traumatic|emdr|hypnoti[sz]\w*|regression|past li(fe|ves)|inner child wound)\b/i, code: "unsafe_technique" },
  ],
  pl: [
    { re: /(wylecz\w*|uleczy\w*|leczy\w* (lęk|depresj|bezsenność|traum)|terapi\w*|diagnoz\w*|leki\b|lekarstw\w*)/i, code: "medical_claim" },
    { re: /(gwarant\w*|klinicznie udowodnion\w*|przeprogramuj\w*|neuron\w*)/i, code: "medical_claim" },
    { re: /(traum\w*|emdr|hipno\w*|regresj\w*|poprzednie wcielen\w*)/i, code: "unsafe_technique" },
  ],
  es: [
    { re: /\b(cura[rs]?|curación|sana[rs]? (tu|la) (ansiedad|depresión|trauma)|tratamiento|terapia|diagnóstic\w*|medicación)\b/i, code: "medical_claim" },
    { re: /\b(garantiz\w*|clínicamente probad\w*|reprograma\w*|neuronas)\b/i, code: "medical_claim" },
    { re: /\b(trauma\w*|emdr|hipno\w*|regresión|vidas pasadas)\b/i, code: "unsafe_technique" },
  ],
};

const BREATH_HOLD: Record<RecordingLanguage, RegExp> = {
  en: /hold (your|the) breath(?! is)/i,
  pl: /wstrzymaj (oddech|powietrze)/i,
  es: /(ret[eé]n|aguanta|mant[eé]n) (el aire|la respiración)/i,
};

const WAKE: Record<RecordingLanguage, RegExp> = {
  en: /\b(open your eyes|wake up|feeling refreshed and alert)\b/i,
  pl: /(otwórz oczy|obudź się|przebudź)/i,
  es: /(abre los ojos|despierta)/i,
};

export function detectLanguageScore(text: string, language: RecordingLanguage): number {
  const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length < 8) return 1;
  const hits = (lang: RecordingLanguage) => words.filter((w) => STOPWORDS[lang].includes(w)).length / words.length;
  const own = hits(language);
  const best = Math.max(...(Object.keys(STOPWORDS) as RecordingLanguage[]).map(hits));
  return best === 0 ? 0 : own / best;
}

export function maxNameUses(durationMin: number, preview = false): number {
  return preview ? 2 : Math.min(3, 1 + Math.floor(durationMin / 10));
}

/** Rough per-session character ceiling — protects against runaway scripts (cost control). */
export function charBudget(durationMin: number, preview = false): number {
  return preview ? 420 : Math.round(durationMin * 60 * 2.6 * 6.5 * 0.75) + 600;
}

export function validateScenario(
  lines: Pick<DraftLine, "phase" | "text" | "type">[],
  opts: {
    technique: TechniqueDef;
    language: RecordingLanguage;
    address: string;
    durationMin: number;
    preview?: boolean;
  },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { technique, language, address, preview } = opts;
  const chars = lines.reduce((a, l) => a + l.text.length, 0);
  if (!lines.length) return { ok: false, issues: [{ code: "empty", severity: "error" }], chars };

  if (!preview) {
    // Structure: required phases must appear, in the technique's order.
    const present = lines.map((l) => l.phase);
    for (const p of technique.phases.filter((p) => p.required)) {
      if (!present.includes(p.phase)) issues.push({ code: "missing_phase", detail: p.phase, severity: "error" });
    }
    const order = technique.phases.map((p) => p.phase);
    let cursor = 0;
    for (const phase of dedupeConsecutive(present)) {
      const idx = order.indexOf(phase, cursor);
      if (idx === -1) {
        // phase appearing earlier again is only allowed for repeated phases in the structure
        if (!order.includes(phase)) issues.push({ code: "phase_order", detail: phase, severity: "error" });
        else if (order.lastIndexOf(phase) < cursor) issues.push({ code: "phase_order", detail: phase, severity: "warning" });
        continue;
      }
      cursor = idx;
    }
  }

  const all = lines.map((l) => l.text).join(" ");
  if (detectLanguageScore(all, language) < 0.6) issues.push({ code: "language_mismatch", severity: "error" });

  for (const rule of BLOCKED[language]) {
    const m = all.match(rule.re);
    if (m) issues.push({ code: rule.code, detail: m[0], severity: "error" });
  }

  if (BREATH_HOLD[language].test(all)) issues.push({ code: "breath_hold", severity: "error" });

  if (technique.sleepEnding && !preview) {
    const tail = lines.slice(-4).map((l) => l.text).join(" ");
    if (WAKE[language].test(tail)) issues.push({ code: "wake_in_sleep", severity: "error" });
  }

  if (address) {
    const re = new RegExp(`(^|[^\\p{L}])${escapeRe(address)}(?=$|[^\\p{L}])`, "giu");
    const uses = (all.match(re) ?? []).length;
    if (uses > maxNameUses(opts.durationMin, preview) + 1) issues.push({ code: "name_overuse", detail: String(uses), severity: "error" });
    if (preview) {
      const firstWords = lines[0].text.split(/\s+/).slice(0, 8).join(" ");
      if (!new RegExp(escapeRe(address), "iu").test(firstWords)) issues.push({ code: "name_missing", severity: "error" });
    }
  }

  for (const l of lines) if (l.text.length > 420) issues.push({ code: "segment_too_long", severity: "error" });
  if (chars > charBudget(opts.durationMin, preview)) issues.push({ code: "too_many_chars", detail: String(chars), severity: "error" });

  return { ok: !issues.some((i) => i.severity === "error"), issues, chars };
}

function dedupeConsecutive(list: PhaseType[]): PhaseType[] {
  return list.filter((p, i) => i === 0 || list[i - 1] !== p);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Screening for free-text user input before it can reach TTS or an LLM. */
export function screenUserInput(values: (string | undefined)[]): { ok: boolean; reason?: string } {
  const text = values.filter(Boolean).join(" \n ");
  if (/https?:\/\/|www\.|\.(com|pl|es|net|org)\b/i.test(text)) return { ok: false, reason: "links" };
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return { ok: false, reason: "contact_details" };
  if (/(\d[\s-]?){9,}/.test(text)) return { ok: false, reason: "contact_details" };
  if (/(ignore (all|previous|the above)|system prompt|you are now|act as|jailbreak)/i.test(text)) return { ok: false, reason: "instructions" };
  if (/(kill|suicide|self[- ]harm|zabij|samobój|suicid|matar)/i.test(text)) return { ok: false, reason: "sensitive" };
  return { ok: true };
}
