/**
 * Phrase bank format. Placeholders:
 *  {name}       form of address (vocative in Polish)
 *  {goal}       infinitive goal phrase ("unwind after the day")
 *  {placeLoc}   curated locative phrase ("on a quiet beach")
 *  {placeNom}   curated noun phrase ("a quiet beach")
 *  {placeFree}  user's own words — only used after a colon / in nominative-safe frames
 *  {intention}  user's intention, quoted as-is
 *  {situation}  user's desired situation / event, as-is
 *  {emotions}   joined list of spoken emotion forms
 *  {region} {area} body region names
 *  {item}       a personal context item label, as-is
 */
export interface PhraseBank {
  and: string; // list joiner word
  openers: { default: string[]; relaxation: string[]; meditation: string[]; visualization: string[]; sleep: string[]; growth: string[] };
  previewBridge: string[];
  goalLine: string[];
  stopOption: string;
  neutralOption: string;
  eyesOpenOption: string;
  arrival: string[];
  breath_settle: string[];
  breath_pattern: { intro: string[]; inhale: string; exhale: string; count: string[]; own: string; outro: string[] };
  body_scan: { intro: string[]; regions: string[]; templates: string[]; outro: string[] };
  pmr: {
    intro: string[];
    groups: { id: string; area: string; tense: string; release: string }[];
    notice: string[];
    outro: string[];
  };
  intention: { withIntention: string[]; generic: string[]; returnWith: string[]; returnGeneric: string[] };
  rotation: { intro: string[]; parts: string[]; outro: string[] };
  opposites: string[];
  imagery_place: { openCurated: string[]; openFree: string[]; openGeneric: string[]; senses: string[] };
  imagery_goal: { withSituation: string[]; generic: string[]; senses: string[]; steps: string[] };
  imagery_confidence: { withSituation: string[]; generic: string[]; body: string[]; unexpected: string[] };
  future_self: string[];
  safe_place: { open: string[]; details: string[]; anchor: string[] };
  awareness: string[];
  gratitude: { withFocus: string[]; generic: string[] };
  energize: string[];
  reflection: string[];
  sleep_descent: string[];
  integration: { generic: string[]; withEmotions: string[]; withName: string[] };
  return: { withName: string[]; plain: string[] };
  sleep_close: string[];
  contextLine: { motivation: string[]; aspiration: string[]; goal: string[]; person: string[]; memory: string[] };
}
