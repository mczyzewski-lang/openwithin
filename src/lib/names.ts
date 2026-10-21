/**
 * Forms of address. Polish requires the vocative case when a name is used to address
 * someone ("Marek" → "Marku", "Anna" → "Anno"). We compute a best guess, show it to the
 * user in the form ("We'll address you as: Marku") and let them correct it.
 */

const PL_EXCEPTIONS: Record<string, string> = {
  marek: "Marku",
  jacek: "Jacku",
  wojtek: "Wojtku",
  bartek: "Bartku",
  franek: "Franku",
  antek: "Antku",
  kuba: "Kubo",
  ola: "Olu",
  ela: "Elu",
  ala: "Alu",
  iza: "Izo",
  piotr: "Piotrze",
  paweł: "Pawle",
  michał: "Michale",
  rafał: "Rafale",
  karol: "Karolu",
  daniel: "Danielu",
  kamil: "Kamilu",
  maciej: "Macieju",
  andrzej: "Andrzeju",
  mateusz: "Mateuszu",
  tomasz: "Tomaszu",
  łukasz: "Łukaszu",
  grzegorz: "Grzegorzu",
  jerzy: "Jerzy",
  antoni: "Antoni",
  jan: "Janie",
  adam: "Adamie",
  adrian: "Adrianie",
  marcin: "Marcinie",
  szymon: "Szymonie",
  krzysztof: "Krzysztofie",
  wiktor: "Wiktorze",
  artur: "Arturze",
  igor: "Igorze",
  oskar: "Oskarze",
  aleksander: "Aleksandrze",
  dawid: "Dawidzie",
  witold: "Witoldzie",
  ryszard: "Ryszardzie",
  bogdan: "Bogdanie",
  zbigniew: "Zbigniewie",
  stanisław: "Stanisławie",
  mirosław: "Mirosławie",
  bolesław: "Bolesławie",
  kasia: "Kasiu",
  basia: "Basiu",
  zosia: "Zosiu",
  asia: "Asiu",
  gosia: "Gosiu",
  marysia: "Marysiu",
  ania: "Aniu",
  hania: "Haniu",
  natalia: "Natalio",
  julia: "Julio",
  maria: "Mario",
  zofia: "Zofio",
  beata: "Beato",
  agnieszka: "Agnieszko",
  małgorzata: "Małgorzato",
  dorota: "Doroto",
  ewa: "Ewo",
  anna: "Anno",
  monika: "Moniko",
  magda: "Magdo",
  magdalena: "Magdaleno",
  joanna: "Joanno",
  katarzyna: "Katarzyno",
  barbara: "Barbaro",
  alicja: "Alicjo",
  karolina: "Karolino",
  weronika: "Weroniko",
  dominika: "Dominiko",
  marta: "Marto",
  paulina: "Paulino",
  ewelina: "Ewelino",
  justyna: "Justyno",
  krystyna: "Krystyno",
  teresa: "Tereso",
  iwona: "Iwono",
  elżbieta: "Elżbieto",
  jadwiga: "Jadwigo",
  halina: "Halino",
  aleksandra: "Aleksandro",
  wiktoria: "Wiktorio",
  amelia: "Amelio",
  lena: "Leno",
  maja: "Maju",
  nina: "Nino",
  ida: "Ido",
  ignacy: "Ignacy",
  kacper: "Kacprze",
  piotrek: "Piotrku",
  tadeusz: "Tadeuszu",
  józef: "Józefie",
};

function matchCase(original: string, result: string): string {
  return original[0] === original[0].toUpperCase() ? result[0].toUpperCase() + result.slice(1) : result;
}

/** Best-effort Polish vocative for a first name (single word). */
export function polishVocative(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || /\s/.test(trimmed)) return trimmed;
  const lower = trimmed.toLocaleLowerCase("pl");
  const exception = PL_EXCEPTIONS[lower];
  if (exception) return exception;

  const rules: [RegExp, (m: string) => string][] = [
    [/(.*)[scz]ia$/, (s) => s.replace(/ia$/, "iu")], // Kasia → Kasiu (diminutives)
    [/^.{1,3}nia$/, (s) => s.replace(/ia$/, "iu")], // Ania → Aniu, Hania → Haniu
    [/(.*)ia$/, (s) => s.replace(/ia$/, "io")], // Natalia → Natalio
    [/(.*)ja$/, (s) => s.replace(/ja$/, "ju")], // Maja → Maju
    [/(.*)a$/, (s) => s.replace(/a$/, "o")], // Ewa → Ewo, Monika → Moniko
    [/(.*)ek$/, (s) => s.replace(/ek$/, "ku")], // Marek → Marku
    [/(.*)(sz|cz|rz|ż|j|l|g|k|ch|h)$/, (s) => s + "u"], // Tomasz → Tomaszu, Karol → Karolu
    [/(.*)ł$/, (s) => s.replace(/ł$/, "le")], // Michał → Michale
    [/(.*)r$/, (s) => s.replace(/r$/, "rze")], // Piotr → Piotrze
    [/(.*)t$/, (s) => s.replace(/t$/, "cie")], // Robert → Robercie
    [/(.*)d$/, (s) => s.replace(/d$/, "dzie")], // Dawid → Dawidzie
    [/(.*)[nmbpfwsz]$/, (s) => s + "ie"], // Adam → Adamie, Jan → Janie
  ];
  for (const [re, fn] of rules) {
    if (re.test(lower)) return matchCase(trimmed, fn(lower));
  }
  return trimmed;
}

/** The form of address spoken in a recording language. */
export function defaultAddressForm(firstName: string, language: string): string {
  const name = firstName.trim();
  if (language === "pl") return polishVocative(name);
  return name;
}
