/**
 * Choice options used by the personalization form. Each option has a UI label per UI
 * locale and a *spoken* form per recording language. Spoken forms are grammatically
 * prepared (e.g. Polish locative "na spokojnej plaży") so the composer never has to
 * inflect free text.
 */
import type { AmbientId } from "./techniques/registry";

type L3 = { en: string; pl: string; es: string };

export interface Option<S = string> {
  id: string;
  label: L3;
  spoken?: { en: S; pl: S; es: S };
}

export interface PlaceForms {
  /** nominative / standalone noun phrase: "a quiet beach" */
  nom: string;
  /** "where" phrase: "on a quiet beach" / "na spokojnej plaży" / "en una playa tranquila" */
  loc: string;
}

export const GOALS: Option[] = [
  {
    id: "unwind",
    label: { en: "Unwind after the day", pl: "Odpocząć po dniu", es: "Desconectar tras el día" },
    spoken: { en: "unwind after the day", pl: "odpocząć po całym dniu", es: "desconectar después del día" },
  },
  {
    id: "release_tension",
    label: { en: "Release tension", pl: "Uwolnić napięcie", es: "Soltar la tensión" },
    spoken: { en: "let go of tension you have been carrying", pl: "puścić napięcie, które nosisz w sobie", es: "soltar la tensión que has ido acumulando" },
  },
  {
    id: "slow_down",
    label: { en: "Slow down", pl: "Zwolnić", es: "Bajar el ritmo" },
    spoken: { en: "slow down and simply be here", pl: "zwolnić i po prostu tu być", es: "bajar el ritmo y simplemente estar aquí" },
  },
  {
    id: "rest",
    label: { en: "Prepare for rest", pl: "Przygotować się do odpoczynku", es: "Prepararme para descansar" },
    spoken: { en: "prepare your body and mind for rest", pl: "przygotować ciało i umysł do odpoczynku", es: "preparar el cuerpo y la mente para el descanso" },
  },
  {
    id: "focus",
    label: { en: "Find focus", pl: "Odzyskać skupienie", es: "Encontrar enfoque" },
    spoken: { en: "gather your attention and find focus", pl: "zebrać uwagę i odnaleźć skupienie", es: "reunir tu atención y encontrar el enfoque" },
  },
  {
    id: "clarity",
    label: { en: "Clear my mind", pl: "Uporządkować myśli", es: "Aclarar la mente" },
    spoken: { en: "give your thoughts some space", pl: "dać swoim myślom trochę przestrzeni", es: "dar un poco de espacio a tus pensamientos" },
  },
  {
    id: "energy",
    label: { en: "Recharge", pl: "Naładować energię", es: "Recargar energía" },
    spoken: { en: "recharge and return with fresh energy", pl: "naładować się i wrócić ze świeżą energią", es: "recargarte y volver con energía renovada" },
  },
  {
    id: "balance",
    label: { en: "Feel more balanced", pl: "Odzyskać równowagę", es: "Sentir más equilibrio" },
    spoken: { en: "come back to a sense of balance", pl: "wrócić do poczucia równowagi", es: "volver a una sensación de equilibrio" },
  },
];

export const TENSION_AREAS: Option<{ name: string }>[] = [
  { id: "neck_shoulders", label: { en: "Neck & shoulders", pl: "Kark i ramiona", es: "Cuello y hombros" } },
  { id: "jaw_face", label: { en: "Jaw & face", pl: "Szczęka i twarz", es: "Mandíbula y cara" } },
  { id: "back", label: { en: "Back", pl: "Plecy", es: "Espalda" } },
  { id: "hands_arms", label: { en: "Hands & arms", pl: "Dłonie i ręce", es: "Manos y brazos" } },
  { id: "belly_chest", label: { en: "Chest & belly", pl: "Klatka i brzuch", es: "Pecho y abdomen" } },
  { id: "legs_feet", label: { en: "Legs & feet", pl: "Nogi i stopy", es: "Piernas y pies" } },
];

export const PACES: Option[] = [
  { id: "slow", label: { en: "Very slow", pl: "Bardzo wolno", es: "Muy lento" } },
  { id: "calm", label: { en: "Calm", pl: "Spokojnie", es: "Tranquilo" } },
  { id: "natural", label: { en: "Natural", pl: "Naturalnie", es: "Natural" } },
];

export const SETTINGS: Option<PlaceForms>[] = [
  {
    id: "beach",
    label: { en: "A quiet beach", pl: "Spokojna plaża", es: "Una playa tranquila" },
    spoken: {
      en: { nom: "a quiet beach", loc: "on a quiet beach" },
      pl: { nom: "spokojna plaża", loc: "na spokojnej plaży" },
      es: { nom: "una playa tranquila", loc: "en una playa tranquila" },
    },
  },
  {
    id: "forest",
    label: { en: "A forest", pl: "Las", es: "Un bosque" },
    spoken: {
      en: { nom: "a calm forest", loc: "in a calm forest" },
      pl: { nom: "spokojny las", loc: "w spokojnym lesie" },
      es: { nom: "un bosque sereno", loc: "en un bosque sereno" },
    },
  },
  {
    id: "mountains",
    label: { en: "Mountains", pl: "Góry", es: "Montañas" },
    spoken: {
      en: { nom: "a mountain meadow", loc: "high in the mountains" },
      pl: { nom: "górska polana", loc: "wysoko w górach" },
      es: { nom: "un prado de montaña", loc: "en lo alto de las montañas" },
    },
  },
  {
    id: "meadow",
    label: { en: "A sunny meadow", pl: "Słoneczna łąka", es: "Una pradera soleada" },
    spoken: {
      en: { nom: "a sunlit meadow", loc: "in a sunlit meadow" },
      pl: { nom: "słoneczna łąka", loc: "na słonecznej łące" },
      es: { nom: "una pradera soleada", loc: "en una pradera soleada" },
    },
  },
  {
    id: "lake",
    label: { en: "A still lake", pl: "Jezioro", es: "Un lago en calma" },
    spoken: {
      en: { nom: "a still lake", loc: "by a still lake" },
      pl: { nom: "spokojne jezioro", loc: "nad spokojnym jeziorem" },
      es: { nom: "un lago en calma", loc: "junto a un lago en calma" },
    },
  },
  {
    id: "garden",
    label: { en: "A garden", pl: "Ogród", es: "Un jardín" },
    spoken: {
      en: { nom: "a quiet garden", loc: "in a quiet garden" },
      pl: { nom: "cichy ogród", loc: "w cichym ogrodzie" },
      es: { nom: "un jardín silencioso", loc: "en un jardín silencioso" },
    },
  },
  {
    id: "cozy_room",
    label: { en: "A cozy room", pl: "Przytulny pokój", es: "Una habitación acogedora" },
    spoken: {
      en: { nom: "a warm, cozy room", loc: "in a warm, cozy room" },
      pl: { nom: "ciepły, przytulny pokój", loc: "w ciepłym, przytulnym pokoju" },
      es: { nom: "una habitación cálida y acogedora", loc: "en una habitación cálida y acogedora" },
    },
  },
  {
    id: "starry_sky",
    label: { en: "Under the stars", pl: "Pod gwiazdami", es: "Bajo las estrellas" },
    spoken: {
      en: { nom: "an open night sky", loc: "under an open, starry sky" },
      pl: { nom: "rozgwieżdżone niebo", loc: "pod rozgwieżdżonym niebem" },
      es: { nom: "un cielo estrellado", loc: "bajo un cielo abierto y estrellado" },
    },
  },
];

export const EMOTIONS: Option[] = [
  { id: "calm", label: { en: "Calm", pl: "Spokój", es: "Calma" }, spoken: { en: "calm", pl: "spokój", es: "calma" } },
  { id: "confidence", label: { en: "Confidence", pl: "Pewność siebie", es: "Confianza" }, spoken: { en: "quiet confidence", pl: "spokojna pewność siebie", es: "una confianza serena" } },
  { id: "joy", label: { en: "Joy", pl: "Radość", es: "Alegría" }, spoken: { en: "joy", pl: "radość", es: "alegría" } },
  { id: "gratitude", label: { en: "Gratitude", pl: "Wdzięczność", es: "Gratitud" }, spoken: { en: "gratitude", pl: "wdzięczność", es: "gratitud" } },
  { id: "focus", label: { en: "Focus", pl: "Skupienie", es: "Enfoque" }, spoken: { en: "clear focus", pl: "jasne skupienie", es: "un enfoque claro" } },
  { id: "lightness", label: { en: "Lightness", pl: "Lekkość", es: "Ligereza" }, spoken: { en: "lightness", pl: "lekkość", es: "ligereza" } },
  { id: "courage", label: { en: "Courage", pl: "Odwaga", es: "Valentía" }, spoken: { en: "courage", pl: "odwaga", es: "valentía" } },
  { id: "warmth", label: { en: "Warmth", pl: "Ciepło", es: "Calidez" }, spoken: { en: "warmth", pl: "ciepło", es: "calidez" } },
];

export const AMBIENTS: { id: AmbientId; label: L3 }[] = [
  { id: "rain", label: { en: "Soft rain", pl: "Delikatny deszcz", es: "Lluvia suave" } },
  { id: "ocean", label: { en: "Ocean waves", pl: "Fale oceanu", es: "Olas del mar" } },
  { id: "wind", label: { en: "Gentle wind", pl: "Łagodny wiatr", es: "Viento suave" } },
  { id: "soft_tones", label: { en: "Soft tones", pl: "Miękkie tony", es: "Tonos suaves" } },
  { id: "night", label: { en: "Quiet night", pl: "Cicha noc", es: "Noche tranquila" } },
  { id: "none", label: { en: "Voice only", pl: "Tylko głos", es: "Solo voz" } },
];

export const BREATH_PACES: (Option & { inhale: number; exhale: number })[] = [
  { id: "gentle", inhale: 4, exhale: 6, label: { en: "Gentle (in 4 · out 6)", pl: "Łagodny (wdech 4 · wydech 6)", es: "Suave (inhala 4 · exhala 6)" } },
  { id: "even", inhale: 4, exhale: 4, label: { en: "Even (in 4 · out 4)", pl: "Równy (wdech 4 · wydech 4)", es: "Equilibrado (inhala 4 · exhala 4)" } },
  { id: "slow", inhale: 4, exhale: 8, label: { en: "Slow exhale (in 4 · out 8)", pl: "Długi wydech (wdech 4 · wydech 8)", es: "Exhalación lenta (inhala 4 · exhala 8)" } },
];

export const STYLES: Option[] = [
  { id: "gentle", label: { en: "Gentle & warm", pl: "Łagodny i ciepły", es: "Suave y cálido" } },
  { id: "grounded", label: { en: "Grounded & simple", pl: "Prosty i konkretny", es: "Sencillo y sereno" } },
  { id: "poetic", label: { en: "Poetic & imaginative", pl: "Poetycki i obrazowy", es: "Poético e imaginativo" } },
  { id: "minimal", label: { en: "Minimal, more silence", pl: "Minimalny, więcej ciszy", es: "Mínimo, más silencio" } },
];

export function findOption<T extends { id: string }>(list: T[], id: string | undefined | null): T | undefined {
  return id ? list.find((o) => o.id === id) : undefined;
}
