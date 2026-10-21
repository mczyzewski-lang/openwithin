import "server-only";
import type { PhaseType } from "@/content/techniques/registry";
import { estimateSpeechMs, type PlannedLine } from "../scenario/composer";
import type { PersonalizationContext } from "../scenario/types";
import { validateScenario, type ValidationResult } from "../scenario/validate";

/**
 * Studio templates store an approved base script with placeholders:
 *   {{name}} {{place}} {{intention}} {{goal}} {{situation}}
 * Each buyer gets a personalised instance; the template itself is never modified.
 */
export interface BaseSegment {
  phase: PhaseType;
  type: string;
  text: string;
  pause_after_ms: number;
  pause_fixed?: boolean;
}

export const PLACEHOLDERS = ["name", "place", "intention", "goal", "situation"] as const;

function valuesFor(ctx: PersonalizationContext): Record<string, string | undefined> {
  return {
    name: ctx.address,
    place: ctx.place?.free ?? ctx.place?.curated?.nom,
    intention: ctx.intention,
    goal: ctx.goal,
    situation: ctx.situation,
  };
}

/** Replace placeholders; sentences whose placeholder has no value are dropped (never spoken half-empty). */
export function fillTemplateText(text: string, values: Record<string, string | undefined>): string {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  return sentences
    .filter((s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].every((m) => values[m[1]]))
    .map((s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function personalizeTemplate(base: BaseSegment[], ctx: PersonalizationContext): { lines: PlannedLine[]; validation: ValidationResult } {
  const values = valuesFor(ctx);
  const lines: PlannedLine[] = [];
  for (const seg of base) {
    const text = fillTemplateText(seg.text, values);
    if (!text) {
      // keep the silence even if the sentence was dropped
      if (lines.length) lines[lines.length - 1].pauseAfterMs += seg.pause_after_ms;
      continue;
    }
    lines.push({ phase: seg.phase, type: seg.type, text, pauseAfterMs: seg.pause_after_ms, ...(seg.pause_fixed ? { fixedPauseMs: seg.pause_after_ms } : {}) });
  }
  const validation = validateScenario(lines, { technique: ctx.technique, language: ctx.language, address: ctx.address, durationMin: ctx.durationMin });
  return { lines, validation };
}

/** First seconds of a template, personalised — used for the 15-second product preview. */
export function templatePreviewLines(base: BaseSegment[], ctx: PersonalizationContext, maxSpeechMs = 12_500): string[] {
  const values = valuesFor(ctx);
  const out: string[] = [];
  let used = 0;
  for (const seg of base) {
    const text = fillTemplateText(seg.text, values);
    if (!text) continue;
    const ms = estimateSpeechMs(text, ctx);
    if (out.length && used + ms > maxSpeechMs) break;
    if (!out.length && ms > maxSpeechMs) {
      out.push(text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" "));
      break;
    }
    out.push(text);
    used += ms;
  }
  return out;
}

export function planToBase(lines: PlannedLine[]): BaseSegment[] {
  return lines.map((l) => ({ phase: l.phase, type: l.type, text: l.text, pause_after_ms: l.pauseAfterMs, pause_fixed: l.fixedPauseMs !== undefined }));
}
