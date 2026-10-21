import type { TechniqueId } from "./techniques/registry";

type L3 = { en: string; pl: string; es: string };

export interface SystemProgram {
  key: string;
  title: L3;
  description: L3;
  days: { technique: TechniqueId; durationMin: number; focus: L3 }[];
}

const d = (technique: TechniqueId, durationMin: number, en: string, pl: string, es: string) => ({
  technique,
  durationMin,
  focus: { en, pl, es },
});

export const SYSTEM_PROGRAMS: SystemProgram[] = [
  {
    key: "seven-days-relaxation",
    title: { en: "7 Days of Relaxation", pl: "7 dni relaksacji", es: "7 días de relajación" },
    description: {
      en: "A gentle week moving from breath to body to imagery. Ten minutes a day.",
      pl: "Łagodny tydzień: od oddechu, przez ciało, do wyobraźni. Dziesięć minut dziennie.",
      es: "Una semana suave que va de la respiración al cuerpo y a la imaginación. Diez minutos al día.",
    },
    days: [
      d("guided_breathing", 5, "Arriving in the breath", "Przybycie do oddechu", "Llegar a la respiración"),
      d("body_scan", 10, "Noticing the body", "Zauważanie ciała", "Notar el cuerpo"),
      d("pmr", 10, "Tension and release", "Napięcie i rozluźnienie", "Tensión y liberación"),
      d("deep_relaxation", 10, "Letting go more deeply", "Głębsze odpuszczanie", "Soltar más profundamente"),
      d("safe_place", 10, "Your calm place", "Twoje miejsce spokoju", "Tu lugar de calma"),
      d("mindfulness", 10, "Resting in awareness", "Odpoczynek w uważności", "Descansar en la atención"),
      d("yoga_nidra", 15, "A first Yoga Nidra", "Pierwsza Joga Nidra", "Un primer Yoga Nidra"),
    ],
  },
  {
    key: "fourteen-days-evening-calm",
    title: { en: "14 Days of Evening Calm", pl: "14 dni wieczornego spokoju", es: "14 días de calma nocturna" },
    description: {
      en: "Two weeks of short evening rituals to close the day softly.",
      pl: "Dwa tygodnie krótkich wieczornych rytuałów, by łagodnie zamykać dzień.",
      es: "Dos semanas de breves rituales nocturnos para cerrar el día con suavidad.",
    },
    days: Array.from({ length: 14 }, (_, i) => {
      const cycle: [TechniqueId, number, string, string, string][] = [
        ["evening_relaxation", 10, "Closing the day", "Zamykanie dnia", "Cerrar el día"],
        ["bedtime_relaxation", 15, "Releasing the body", "Rozluźnianie ciała", "Soltar el cuerpo"],
        ["gratitude", 10, "Small good things", "Małe dobre rzeczy", "Pequeñas cosas buenas"],
        ["sleep_meditation", 20, "Drifting towards rest", "Ku odpoczynkowi", "Hacia el descanso"],
        ["guided_breathing", 5, "A slower exhale", "Dłuższy wydech", "Una exhalación más lenta"],
        ["body_scan", 15, "A soft body scan", "Łagodne skanowanie ciała", "Un escaneo suave"],
        ["yoga_nidra", 20, "Evening Yoga Nidra", "Wieczorna Joga Nidra", "Yoga Nidra nocturno"],
      ];
      const [t, m, en, pl, es] = cycle[i % cycle.length];
      return d(t, m, en, pl, es);
    }),
  },
  {
    key: "introduction-to-jacobson",
    title: { en: "Introduction to Jacobson", pl: "Wprowadzenie do treningu Jacobsona", es: "Introducción a Jacobson" },
    description: {
      en: "Learn progressive muscle relaxation step by step over five sessions.",
      pl: "Poznaj trening Jacobsona krok po kroku w pięciu sesjach.",
      es: "Aprende la relajación muscular progresiva paso a paso en cinco sesiones.",
    },
    days: [
      d("pmr", 5, "Hands and arms", "Dłonie i ręce", "Manos y brazos"),
      d("pmr", 10, "Shoulders and face", "Ramiona i twarz", "Hombros y cara"),
      d("pmr", 10, "Back and belly", "Plecy i brzuch", "Espalda y abdomen"),
      d("pmr", 15, "The whole body", "Całe ciało", "Todo el cuerpo"),
      d("pmr", 20, "Release without tension", "Rozluźnienie bez napinania", "Soltar sin tensar"),
    ],
  },
  {
    key: "seven-days-mindfulness",
    title: { en: "7 Days of Mindfulness", pl: "7 dni uważności", es: "7 días de mindfulness" },
    description: {
      en: "A week of short, practical mindfulness sessions with growing silence.",
      pl: "Tydzień krótkich, praktycznych sesji uważności z coraz dłuższą ciszą.",
      es: "Una semana de sesiones de mindfulness breves y prácticas, con cada vez más silencio.",
    },
    days: [
      d("guided_meditation", 5, "First steps", "Pierwsze kroki", "Primeros pasos"),
      d("mindfulness", 5, "The breath as anchor", "Oddech jako kotwica", "La respiración como ancla"),
      d("body_scan", 10, "Body awareness", "Uważność ciała", "Conciencia del cuerpo"),
      d("mindfulness", 10, "Listening to sounds", "Słuchanie dźwięków", "Escuchar los sonidos"),
      d("mindfulness", 10, "Watching thoughts", "Obserwowanie myśli", "Observar los pensamientos"),
      d("gratitude", 10, "Kind attention", "Życzliwa uwaga", "Atención amable"),
      d("mindfulness", 15, "Open awareness", "Otwarta uważność", "Atención abierta"),
    ],
  },
  {
    key: "guided-visualization-journey",
    title: { en: "Guided Visualization Journey", pl: "Podróż z wizualizacją", es: "Viaje de visualización guiada" },
    description: {
      en: "Five sessions from a calm inner place to your future self.",
      pl: "Pięć sesji: od spokojnego miejsca wewnątrz do przyszłego „ja”.",
      es: "Cinco sesiones desde un lugar interior de calma hasta tu yo futuro.",
    },
    days: [
      d("safe_place", 10, "Your inner place", "Twoje wewnętrzne miejsce", "Tu lugar interior"),
      d("guided_visualization", 10, "Exploring with the senses", "Odkrywanie zmysłami", "Explorar con los sentidos"),
      d("confidence_visualization", 10, "Steady confidence", "Stabilna pewność", "Confianza serena"),
      d("goal_visualization", 10, "A goal in detail", "Cel w szczegółach", "Una meta en detalle"),
      d("future_self", 15, "Meeting your future self", "Spotkanie z przyszłym „ja”", "Encuentro con tu yo futuro"),
    ],
  },
];

export function getSystemProgram(key: string) {
  return SYSTEM_PROGRAMS.find((p) => p.key === key);
}
