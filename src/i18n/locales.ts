/**
 * Language configuration. Adding a language is a configuration step:
 * 1. add an entry here (enabled: true),
 * 2. add src/messages/<code>.json,
 * 3. add localized slugs + landing copy in src/content/techniques/<code>.ts,
 * 4. add phrase banks in src/server/scenario/phrases/<code>.ts (optional — LLM can script any language).
 */
export type LocaleCode = "en" | "pl" | "es" | "de" | "fr" | "it" | "pt";

export interface LocaleConfig {
  code: LocaleCode;
  label: string;
  /** UI available (routes, messages, landing pages). */
  uiEnabled: boolean;
  /** Recording language available (voice + scripts). */
  recordingEnabled: boolean;
  defaultMarket: Market;
  bcp47: string;
}

export type Market = "pl" | "eu" | "us" | "intl";

export const LOCALE_CONFIG: Record<LocaleCode, LocaleConfig> = {
  en: { code: "en", label: "English", uiEnabled: true, recordingEnabled: true, defaultMarket: "intl", bcp47: "en-US" },
  pl: { code: "pl", label: "Polski", uiEnabled: true, recordingEnabled: true, defaultMarket: "pl", bcp47: "pl-PL" },
  es: { code: "es", label: "Español", uiEnabled: true, recordingEnabled: true, defaultMarket: "eu", bcp47: "es-ES" },
  // Prepared — flip flags once messages + content are complete.
  de: { code: "de", label: "Deutsch", uiEnabled: false, recordingEnabled: false, defaultMarket: "eu", bcp47: "de-DE" },
  fr: { code: "fr", label: "Français", uiEnabled: false, recordingEnabled: false, defaultMarket: "eu", bcp47: "fr-FR" },
  it: { code: "it", label: "Italiano", uiEnabled: false, recordingEnabled: false, defaultMarket: "eu", bcp47: "it-IT" },
  pt: { code: "pt", label: "Português", uiEnabled: false, recordingEnabled: false, defaultMarket: "eu", bcp47: "pt-PT" },
};

export const UI_LOCALES = (Object.values(LOCALE_CONFIG) as LocaleConfig[])
  .filter((l) => l.uiEnabled)
  .map((l) => l.code) as ("en" | "pl" | "es")[];
export type UiLocale = (typeof UI_LOCALES)[number];

export const RECORDING_LANGUAGES = (Object.values(LOCALE_CONFIG) as LocaleConfig[])
  .filter((l) => l.recordingEnabled)
  .map((l) => l.code);

export const DEFAULT_LOCALE: UiLocale = "en";

export function isUiLocale(v: string | undefined | null): v is UiLocale {
  return !!v && (UI_LOCALES as string[]).includes(v);
}

export function isRecordingLanguage(v: string | undefined | null): v is LocaleCode {
  return !!v && RECORDING_LANGUAGES.includes(v as LocaleCode);
}

export const MARKET_CURRENCY: Record<Market, string> = { pl: "pln", eu: "eur", us: "usd", intl: "usd" };
