import "server-only";
import { randomUUID } from "node:crypto";
import { composePreview, composeScenario, distributePauses, ttsSpeed, type PlannedLine } from "./composer";
import { getScenarioWriter, planPhases } from "./llm";
import type { DraftLine, PersonalizationContext, ScenarioSegment } from "./types";
import { validateScenario, type ValidationResult } from "./validate";

export interface BuiltScenario {
  title: string;
  lines: PlannedLine[];
  source: "llm" | "composer";
  validation: ValidationResult;
  llmError?: string;
}

/** Group LLM lines onto the phase plan (in order) and give each phase its real silence. */
function timeLlmLines(ctx: PersonalizationContext, lines: DraftLine[]): PlannedLine[] {
  const plan = planPhases(ctx);
  const groups: DraftLine[][] = plan.map(() => []);
  let p = 0;
  for (const line of lines) {
    if (plan[p]?.phase !== line.phase) {
      const next = plan.findIndex((x, i) => i > p && x.phase === line.phase);
      if (next !== -1) p = next;
    }
    groups[p].push(line);
  }
  return groups.flatMap((g, i) => (g.length ? distributePauses(g, plan[i].seconds * 1000, ctx) : []));
}

export async function buildFullScenario(ctx: PersonalizationContext, title: string): Promise<BuiltScenario> {
  const validationOpts = { technique: ctx.technique, language: ctx.language, address: ctx.address, durationMin: ctx.durationMin };
  const writer = getScenarioWriter();
  let llmError: string | undefined;
  if (writer) {
    try {
      const drafts = await writer.write(ctx, planPhases(ctx));
      const validation = validateScenario(drafts, validationOpts);
      if (validation.ok) {
        const lines = timeLlmLines(ctx, drafts);
        if (ctx.technique.sleepEnding && lines.length) lines[lines.length - 1].pauseAfterMs = Math.max(lines[lines.length - 1].pauseAfterMs, 30_000);
        return { title, lines, source: "llm", validation };
      }
      llmError = `validation:${validation.issues.map((i) => i.code).join(",")}`;
    } catch (e) {
      llmError = e instanceof Error ? e.message : String(e);
    }
  }
  const composed = composeScenario(ctx, title);
  const validation = validateScenario(composed.lines, validationOpts);
  return { title, lines: composed.lines, source: "composer", validation, llmError };
}

export function buildPreviewLines(ctx: PersonalizationContext): { lines: string[]; validation: ValidationResult } {
  const lines = composePreview(ctx);
  const validation = validateScenario(
    lines.map((text) => ({ phase: "arrival" as const, type: "opening", text })),
    { technique: ctx.technique, language: ctx.language, address: ctx.address, durationMin: 1, preview: true },
  );
  return { lines, validation };
}

export function toSegments(
  lines: PlannedLine[],
  ctx: Pick<PersonalizationContext, "language" | "narrationSpeed" | "ambient">,
  voiceId: string,
  ambientVolume: number,
): ScenarioSegment[] {
  return lines.map((l, i) => ({
    segment_id: randomUUID(),
    phase: l.phase,
    segment_type: l.type,
    spoken_text: l.text,
    language: ctx.language,
    voice_id: voiceId,
    pause_before_ms: i === 0 ? 2500 : 0,
    pause_after_ms: l.pauseAfterMs,
    pause_fixed: l.fixedPauseMs !== undefined,
    ambient_track_id: ctx.ambient,
    ambient_volume: ctx.ambient === "none" ? 0 : ambientVolume,
    speed: ttsSpeed(ctx.narrationSpeed),
  }));
}

export * from "./types";
export { buildContext, cleanUserText } from "./context";
export { screenUserInput, validateScenario } from "./validate";
