/**
 * Deterministic, technique-aware scenario composer.
 *
 * Builds a full session from the technique's phase structure: every phase gets a time
 * budget, a speech budget (words) and real silence. Phase generators produce lines;
 * silence is then distributed as pause_after_ms. It is used:
 *  - for every 15-second preview (fast, no LLM cost),
 *  - for full sessions when no LLM is configured,
 *  - as the fallback whenever an LLM scenario fails validation.
 */
import type { PhaseSpec, PhaseType } from "@/content/techniques/registry";
import { en } from "./phrases/en";
import { es } from "./phrases/es";
import { pl } from "./phrases/pl";
import type { PhraseBank } from "./phrases/types";
import type { DraftLine, PersonalizationContext, RecordingLanguage } from "./types";

export const BANKS: Record<RecordingLanguage, PhraseBank> = { en, pl, es };

/** Calm narration speaking rates (words per second) before speed adjustment. */
const WORDS_PER_SEC: Record<RecordingLanguage, number> = { en: 2.25, pl: 1.95, es: 2.35 };
const SPEED_FACTOR = { slow: 0.85, calm: 0.93, natural: 1.0 } as const;

export function speakingRate(ctx: Pick<PersonalizationContext, "language" | "narrationSpeed">): number {
  return WORDS_PER_SEC[ctx.language] * (SPEED_FACTOR[ctx.narrationSpeed] / 0.93);
}

export function ttsSpeed(narrationSpeed: PersonalizationContext["narrationSpeed"]): number {
  return Math.round(SPEED_FACTOR[narrationSpeed] * 100);
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function estimateSpeechMs(text: string, ctx: Pick<PersonalizationContext, "language" | "narrationSpeed">): number {
  // + small allowance for sentence-final prosody
  const sentences = (text.match(/[.!?]/g) ?? []).length;
  return Math.round((wordCount(text) / speakingRate(ctx)) * 1000 + sentences * 250);
}

/* ───────────── deterministic variation ───────────── */

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function fill(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/* ───────────── composer state ───────────── */

class ComposeState {
  readonly bank: PhraseBank;
  readonly random: () => number;
  nameUses = 0;
  readonly maxNameUses: number;
  usedContext = new Set<string>();
  stopOptionSaid = false;
  neutralOptionSaid = false;
  phaseOccurrence = new Map<PhaseType, number>();

  constructor(readonly ctx: PersonalizationContext) {
    this.bank = BANKS[ctx.language];
    this.random = rng(ctx.seed);
    // Natural use of the name: opening, at most once more per ~10 minutes, never more than 3.
    this.maxNameUses = Math.min(3, 1 + Math.floor(ctx.durationMin / 10));
  }

  pick<T>(list: T[]): T {
    return list[Math.floor(this.random() * list.length) % list.length];
  }

  canUseName() {
    return this.nameUses < this.maxNameUses;
  }

  useName() {
    this.nameUses++;
    return this.ctx.address;
  }

  vars(extra: Record<string, string | undefined> = {}) {
    const c = this.ctx;
    return {
      goal: c.goal,
      placeLoc: c.place?.curated?.loc,
      placeNom: c.place?.curated?.nom,
      placeFree: c.place?.free,
      intention: c.intention,
      situation: c.situation,
      emotions: joinList(c.emotions, this.bank.and),
      focus: c.gratitudeFocus,
      ...extra,
    };
  }

  contextLine(kind: keyof PhraseBank["contextLine"]): string | null {
    const item = this.ctx.contextItems.find((i) => i.kind === kind && !this.usedContext.has(i.label));
    if (!item) return null;
    this.usedContext.add(item.label);
    return fill(this.pick(this.bank.contextLine[kind]), { item: item.label });
  }
}

/* ───────────── phase generators ───────────── */

type Gen = (s: ComposeState, budgetWords: number, phaseMs: number) => DraftLine[];

function takeWithin(lines: string[], budget: number, min = 1): string[] {
  const out: string[] = [];
  let used = 0;
  for (const l of lines) {
    const w = wordCount(l);
    if (out.length >= min && used + w > budget) break;
    out.push(l);
    used += w;
  }
  return out;
}

const L = (phase: PhaseType, text: string, opts: Partial<DraftLine> = {}): DraftLine => ({ phase, type: opts.type ?? phase, text, ...opts });

function openerFor(s: ComposeState): string {
  const { technique } = s.ctx;
  const list = s.bank.openers[technique.category] ?? s.bank.openers.default;
  return fill(s.pick(list), { name: s.useName() });
}

const generators: Record<PhaseType, Gen> = {
  arrival(s, budget) {
    const out: DraftLine[] = [L("arrival", openerFor(s), { type: "opening", pauseWeight: 1.2 })];
    let used = wordCount(out[0].text);
    if (s.ctx.goal) {
      const g = fill(s.pick(s.bank.goalLine), s.vars());
      out.push(L("arrival", g, { type: "opening" }));
      used += wordCount(g);
    }
    if (s.ctx.technique.safety.includes("eyes_open_option")) {
      out.push(L("arrival", s.bank.eyesOpenOption, { type: "safety" }));
      used += wordCount(s.bank.eyesOpenOption);
    }
    for (const line of takeWithin(s.bank.arrival, budget - used - 18, 1)) out.push(L("arrival", line));
    out.push(L("arrival", s.bank.stopOption, { type: "safety", pauseWeight: 0.6 }));
    s.stopOptionSaid = true;
    return out;
  },

  breath_settle(s, budget) {
    return takeWithin(s.bank.breath_settle, budget, 2).map((t) => L("breath_settle", t, { pauseWeight: 1.3 }));
  },

  breath_pattern(s, budget, phaseMs) {
    const b = s.bank.breath_pattern;
    const { inhale, exhale } = s.ctx.breath;
    const out: DraftLine[] = b.intro.map((t) => L("breath_pattern", t, { type: "guidance", pauseWeight: 0.5 }));
    const cycleMs = (inhale + exhale) * 1000 + 1600;
    const introMs = 12000;
    const totalCycles = Math.max(3, Math.floor((phaseMs - introMs - 8000) / cycleMs));
    const guided = Math.min(totalCycles, 8);
    const pushCycles = (n: number) => {
      for (let i = 0; i < n; i++) {
        out.push(L("breath_pattern", b.inhale, { type: "breath_in", fixedPauseMs: inhale * 1000 }));
        out.push(L("breath_pattern", b.exhale, { type: "breath_out", fixedPauseMs: exhale * 1000 + 400 }));
      }
    };
    if (totalCycles > guided + 2) {
      pushCycles(Math.ceil(guided / 2));
      // Silent cycles on the listener's own — real, timed silence rendered by the engine.
      const silentMs = (totalCycles - guided) * (inhale + exhale) * 1000;
      out.push(L("breath_pattern", b.own, { type: "guidance", fixedPauseMs: silentMs }));
      pushCycles(Math.floor(guided / 2));
    } else {
      pushCycles(guided);
    }
    out.push(L("breath_pattern", s.pick(b.outro), { type: "guidance", pauseWeight: 1 }));
    void budget;
    return out;
  },

  body_scan(s, budget) {
    const b = s.bank.body_scan;
    const out: DraftLine[] = [L("body_scan", b.intro[0], { type: "guidance", pauseWeight: 0.6 })];
    const n = Math.max(4, Math.min(b.regions.length, Math.floor(budget / 13)));
    // Keep foot-to-head order, spread evenly, always include the user's tension areas.
    const emphasis: Record<string, number[]> = {
      neck_shoulders: [11, 12],
      jaw_face: [13, 14],
      back: [6, 8],
      hands_arms: [9, 10],
      belly_chest: [5, 7],
      legs_feet: [0, 3],
    };
    const chosen = new Set<number>();
    for (let i = 0; i < n; i++) chosen.add(Math.round((i * (b.regions.length - 1)) / Math.max(1, n - 1)));
    for (const area of s.ctx.tensionAreas) for (const idx of emphasis[area] ?? []) chosen.add(idx);
    const ordered = [...chosen].sort((a, z) => a - z);
    ordered.forEach((idx, i) => {
      const region = b.regions[idx];
      const emphasized = s.ctx.tensionAreas.some((a) => emphasis[a]?.includes(idx));
      out.push(L("body_scan", fill(b.templates[i % b.templates.length], { region }), { pauseWeight: emphasized ? 1.8 : 1.2 }));
    });
    out.push(L("body_scan", b.outro[0], { type: "guidance", pauseWeight: 1.5 }));
    return out;
  },

  pmr_group(s, budget) {
    const p = s.bank.pmr;
    const gentle = s.ctx.technique.safety.includes("no_return_wake"); // bedtime: softer, shorter holds
    const holdMs = gentle ? 4000 : 5000;
    const out: DraftLine[] = p.intro.map((t) => L("pmr_group", t, { type: "guidance", pauseWeight: 0.4 }));
    const groupWords = 26;
    const n = Math.max(3, Math.min(p.groups.length, Math.floor((budget - 25) / groupWords)));
    const chosen = new Set<number>();
    for (let i = 0; i < n; i++) chosen.add(Math.round((i * (p.groups.length - 1)) / Math.max(1, n - 1)));
    p.groups.forEach((g, i) => {
      if (s.ctx.tensionAreas.includes(g.id)) chosen.add(i);
    });
    [...chosen]
      .sort((a, z) => a - z)
      .forEach((i, k) => {
        const g = p.groups[i];
        const focus = s.ctx.tensionAreas.includes(g.id);
        out.push(L("pmr_group", g.tense, { type: "tension", fixedPauseMs: holdMs }));
        out.push(L("pmr_group", g.release, { type: "release", pauseWeight: focus ? 2.4 : 1.8 }));
        if (focus || k % 3 === 2) out.push(L("pmr_group", p.notice[k % p.notice.length], { type: "release", pauseWeight: 1.4 }));
      });
    out.push(L("pmr_group", p.outro[0], { type: "guidance", pauseWeight: 1.5 }));
    return out;
  },

  intention(s) {
    const i = s.bank.intention;
    const occurrence = s.phaseOccurrence.get("intention") ?? 0;
    const has = !!s.ctx.intention;
    const list = occurrence > 0 ? (has ? i.returnWith : i.returnGeneric) : has ? i.withIntention : i.generic;
    return [L("intention", fill(s.pick(list), s.vars()), { pauseWeight: 2 })];
  },

  rotation(s, budget) {
    const r = s.bank.rotation;
    const n = Math.max(10, Math.min(r.parts.length, Math.floor(budget / 2.6)));
    const parts = r.parts.slice(0, n);
    return [
      L("rotation", r.intro[0], { type: "guidance", pauseWeight: 1 }),
      ...parts.map((p) => L("rotation", p, { type: "rotation_point", fixedPauseMs: 1400 })),
      L("rotation", r.outro[0], { type: "guidance", pauseWeight: 2 }),
    ];
  },

  opposites(s, budget) {
    return takeWithin(s.bank.opposites, budget, 2).map((t) => L("opposites", t, { pauseWeight: 1.5 }));
  },

  imagery_place(s, budget) {
    const b = s.bank.imagery_place;
    const out: DraftLine[] = [];
    const { place } = s.ctx;
    if (place?.free) out.push(L("imagery_place", fill(s.pick(b.openFree), s.vars()), { type: "imagery" }));
    else if (place?.curated) out.push(L("imagery_place", fill(s.pick(b.openCurated), s.vars()), { type: "imagery" }));
    else out.push(L("imagery_place", b.openGeneric[0], { type: "imagery" }));
    if (s.ctx.technique.safety.includes("neutral_imagery_option") && !s.neutralOptionSaid) {
      out.push(L("imagery_place", s.bank.neutralOption, { type: "safety", pauseWeight: 0.5 }));
      s.neutralOptionSaid = true;
    }
    const memory = s.contextLine("memory");
    const used = out.reduce((a, l) => a + wordCount(l.text), 0);
    const senses = takeWithin(b.senses, budget - used - (memory ? 12 : 0), 2);
    senses.forEach((t, i) => {
      out.push(L("imagery_place", t, { type: "imagery", pauseWeight: 1.4 }));
      if (memory && i === 1) out.push(L("imagery_place", memory, { type: "personal", pauseWeight: 1.6 }));
    });
    return out;
  },

  imagery_goal(s, budget) {
    const b = s.bank.imagery_goal;
    const out: DraftLine[] = [
      L("imagery_goal", s.ctx.situation ? fill(s.pick(b.withSituation), s.vars()) : b.generic[0], { type: "imagery", pauseWeight: 1.4 }),
    ];
    for (const t of takeWithin(b.senses, Math.max(10, budget * 0.45), 2)) out.push(L("imagery_goal", t, { type: "imagery", pauseWeight: 1.4 }));
    const extra = s.contextLine("motivation") ?? s.contextLine("aspiration") ?? s.contextLine("goal");
    if (extra) out.push(L("imagery_goal", extra, { type: "personal", pauseWeight: 1.4 }));
    for (const t of takeWithin(b.steps, Math.max(10, budget * 0.35), 2)) out.push(L("imagery_goal", t, { type: "imagery", pauseWeight: 1.4 }));
    return out;
  },

  imagery_confidence(s, budget) {
    const b = s.bank.imagery_confidence;
    const out: DraftLine[] = [
      L("imagery_confidence", s.ctx.situation ? fill(s.pick(b.withSituation), s.vars()) : b.generic[0], { type: "imagery", pauseWeight: 1.3 }),
    ];
    for (const t of takeWithin(b.body, budget * 0.6, 2)) out.push(L("imagery_confidence", t, { type: "imagery", pauseWeight: 1.3 }));
    const extra = s.contextLine("motivation") ?? s.contextLine("goal");
    if (extra) out.push(L("imagery_confidence", extra, { type: "personal", pauseWeight: 1.2 }));
    for (const t of b.unexpected) out.push(L("imagery_confidence", t, { type: "imagery", pauseWeight: 1.3 }));
    return out;
  },

  future_self(s, budget) {
    const out = takeWithin(s.bank.future_self, budget, 3).map((t) => L("future_self", t, { type: "imagery", pauseWeight: 1.5 }));
    const extra = s.contextLine("aspiration") ?? s.contextLine("goal");
    if (extra) out.splice(Math.min(3, out.length), 0, L("future_self", extra, { type: "personal", pauseWeight: 1.4 }));
    return out;
  },

  safe_place(s, budget) {
    const b = s.bank.safe_place;
    const out: DraftLine[] = [L("safe_place", b.open[0], { type: "imagery", pauseWeight: 1.2 })];
    if (s.ctx.place?.curated) out.push(L("safe_place", fill(b.open[1], s.vars()), { type: "imagery", pauseWeight: 1.2 }));
    else if (s.ctx.place?.free) out.push(L("safe_place", fill(s.bank.imagery_place.openFree[0], s.vars()), { type: "imagery", pauseWeight: 1.2 }));
    if (!s.neutralOptionSaid) {
      out.push(L("safe_place", s.bank.neutralOption, { type: "safety", pauseWeight: 0.5 }));
      s.neutralOptionSaid = true;
    }
    for (const t of takeWithin(b.details, budget - 30, 3)) out.push(L("safe_place", t, { type: "imagery", pauseWeight: 1.5 }));
    out.push(L("safe_place", b.anchor[0], { type: "imagery", pauseWeight: 1.5 }));
    return out;
  },

  awareness(s, budget) {
    return takeWithin(s.bank.awareness, budget, 3).map((t) => L("awareness", t, { pauseWeight: 2 }));
  },

  gratitude(s, budget) {
    const g = s.bank.gratitude;
    const out: DraftLine[] = [];
    if (s.ctx.gratitudeFocus) for (const t of g.withFocus) out.push(L("gratitude", fill(t, s.vars()), { pauseWeight: 1.6 }));
    const person = s.contextLine("person");
    if (person) out.push(L("gratitude", person, { type: "personal", pauseWeight: 1.6 }));
    const used = out.reduce((a, l) => a + wordCount(l.text), 0);
    for (const t of takeWithin(g.generic, budget - used, 2)) out.push(L("gratitude", t, { pauseWeight: 1.5 }));
    return out;
  },

  energize(s, budget) {
    return takeWithin(s.bank.energize, budget, 3).map((t) => L("energize", t, { pauseWeight: 1 }));
  },

  reflection(s, budget) {
    return takeWithin(s.bank.reflection, budget, 2).map((t) => L("reflection", t, { pauseWeight: 2 }));
  },

  sleep_descent(s, budget) {
    const lines = s.bank.sleep_descent;
    const general = lines.slice(0, 5);
    const countdown = lines.slice(5);
    const chosen = [...takeWithin(general, Math.max(8, budget - 22), 2), ...countdown];
    // Pauses grow as the session descends.
    return chosen.map((t, i) => L("sleep_descent", t, { pauseWeight: 1 + i * 0.35 }));
  },

  integration(s, budget) {
    const b = s.bank.integration;
    const out: DraftLine[] = [];
    if (s.ctx.emotions.length) out.push(L("integration", fill(b.withEmotions[0], s.vars()), { pauseWeight: 1.5 }));
    if (s.ctx.durationMin >= 15 && s.canUseName() && s.nameUses < s.maxNameUses - 1)
      out.push(L("integration", fill(b.withName[0], { name: s.useName() }), { pauseWeight: 1.5 }));
    const used = out.reduce((a, l) => a + wordCount(l.text), 0);
    for (const t of takeWithin(b.generic, budget - used, 1)) out.push(L("integration", t, { pauseWeight: 1.2 }));
    return out;
  },

  return(s) {
    const r = s.bank.return;
    const out: DraftLine[] = [];
    if (s.canUseName()) out.push(L("return", fill(s.pick(r.withName), { name: s.useName() }), { type: "closing", pauseWeight: 1 }));
    for (const t of r.plain) out.push(L("return", t, { type: "closing", pauseWeight: 1 }));
    return out;
  },

  sleep_close(s) {
    return s.bank.sleep_close.map((t, i) => L("sleep_close", t, { type: "closing", pauseWeight: 1 + i * 2 }));
  },
};

/* ───────────── planning ───────────── */

function speechRatio(ctx: PersonalizationContext, phase: PhaseSpec): number {
  let r = phase.speech;
  if (ctx.style === "minimal") r *= 0.72;
  if (ctx.style === "poetic") r *= 1.1;
  if (ctx.pauseLevel === "short") r *= 1.15;
  if (ctx.pauseLevel === "spacious") r *= 0.8;
  // Long sessions breathe more: speak a little less as duration grows.
  if (ctx.durationMin >= 20) r *= 0.9;
  if (ctx.durationMin >= 30) r *= 0.88;
  return Math.min(0.9, Math.max(0.12, r));
}

export interface PlannedLine extends DraftLine {
  pauseAfterMs: number;
}

export interface ComposedScenario {
  title: string;
  lines: PlannedLine[];
  targetMs: number;
  estimatedSpeechMs: number;
}

const MIN_PAUSE_MS = 700;

/** Distribute a phase's silence over its lines. Exported for the editor and LLM path too. */
export function distributePauses(lines: DraftLine[], phaseMs: number, ctx: PersonalizationContext): PlannedLine[] {
  const speech = lines.reduce((a, l) => a + estimateSpeechMs(l.text, ctx), 0);
  const fixed = lines.reduce((a, l) => a + (l.fixedPauseMs ?? 0), 0);
  const flexible = lines.filter((l) => l.fixedPauseMs === undefined);
  const weightSum = flexible.reduce((a, l) => a + (l.pauseWeight ?? 1), 0) || 1;
  const silence = Math.max(flexible.length * MIN_PAUSE_MS, phaseMs - speech - fixed);
  return lines.map((l) => ({
    ...l,
    pauseAfterMs:
      l.fixedPauseMs !== undefined ? l.fixedPauseMs : Math.max(MIN_PAUSE_MS, Math.round((silence * (l.pauseWeight ?? 1)) / weightSum)),
  }));
}

export function composeScenario(ctx: PersonalizationContext, title: string): ComposedScenario {
  const state = new ComposeState(ctx);
  const targetMs = ctx.durationMin * 60_000;
  const phases = ctx.technique.phases;
  const weightSum = phases.reduce((a, p) => a + p.weight, 0);
  const rate = speakingRate(ctx);

  const lines: PlannedLine[] = [];
  for (const phase of phases) {
    const phaseMs = (targetMs * phase.weight) / weightSum;
    const budgetWords = Math.max(8, Math.round((phaseMs / 1000) * speechRatio(ctx, phase) * rate));
    const generated = generators[phase.phase](state, budgetWords, phaseMs);
    state.phaseOccurrence.set(phase.phase, (state.phaseOccurrence.get(phase.phase) ?? 0) + 1);
    lines.push(...distributePauses(generated, phaseMs, ctx));
  }
  if (ctx.technique.sleepEnding && lines.length) {
    // Leave a long ambient tail at the end of sleep sessions.
    lines[lines.length - 1].pauseAfterMs = Math.max(lines[lines.length - 1].pauseAfterMs, 30_000);
  }
  return {
    title,
    lines,
    targetMs,
    estimatedSpeechMs: lines.reduce((a, l) => a + estimateSpeechMs(l.text, ctx), 0),
  };
}

/* ───────────── preview ───────────── */

export const PREVIEW_MAX_MS = 15_000;

/**
 * 15-second personal preview: the real opening of the chosen technique, name in the
 * first sentence, one technique-specific line. Kept under ~13 s of speech so the
 * engine can add a soft fade within the hard 15-second cap.
 */
export function composePreview(ctx: PersonalizationContext): string[] {
  const state = new ComposeState(ctx);
  const b = state.bank;
  const maxWords = Math.floor((12.5 * speakingRate(ctx)) | 0);
  const lines: string[] = [openerFor(state)];
  const second = ctx.technique.previewPhases[1];

  const candidates: string[] = [];
  if (second === "intention" && ctx.intention) candidates.push(fill(b.intention.withIntention[0], state.vars()));
  if ((second === "imagery_place" || second === "safe_place") && ctx.place?.free)
    candidates.push(fill(b.imagery_place.openFree[0], state.vars()));
  if ((second === "imagery_place" || second === "safe_place") && ctx.place?.curated)
    candidates.push(fill(b.imagery_place.openCurated[0], state.vars()));
  if ((second === "imagery_goal" || second === "imagery_confidence") && ctx.situation)
    candidates.push(fill(second === "imagery_goal" ? b.imagery_goal.withSituation[0] : b.imagery_confidence.withSituation[0], state.vars()));
  if (second === "gratitude" && ctx.gratitudeFocus) candidates.push(fill(b.gratitude.withFocus[0], state.vars()));
  if (ctx.goal) candidates.push(fill(state.pick(b.goalLine), state.vars()));
  candidates.push(state.pick(b.previewBridge));
  if (second === "imagery_place") candidates.push(b.imagery_place.openGeneric[0]);

  let used = wordCount(lines[0]);
  for (const c of candidates) {
    if (lines.includes(c)) continue;
    if (used + wordCount(c) > maxWords) continue;
    lines.push(c);
    used += wordCount(c);
    if (lines.length >= 3) break;
  }
  return lines;
}
