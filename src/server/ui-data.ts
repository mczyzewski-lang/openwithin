import "server-only";
import { getTechnique, techniqueCopy, type TechniqueId } from "@/content/techniques";
import type { GeneratorTechnique, GeneratorVoice } from "@/components/funnel/Generator";
import { DEFAULT_VOICES, listVoices } from "./voices";

export function generatorTechnique(locale: string, id: TechniqueId): GeneratorTechnique {
  const t = getTechnique(id)!;
  return {
    id,
    name: techniqueCopy(locale, id).name,
    durations: t.durations,
    defaultDuration: t.defaultDuration,
    questions: t.questions,
    defaultAmbient: t.defaultAmbient,
  };
}

export async function generatorVoices(language = "en"): Promise<GeneratorVoice[]> {
  try {
    const voices = await listVoices(language);
    if (voices.length) return voices.map((v) => ({ id: v.id, label: v.label, character: v.character }));
  } catch {
    // database unavailable at build time — fall back to the bundled presets
  }
  return DEFAULT_VOICES.map((v) => ({ id: v.id, label: v.label, character: v.character }));
}
