import type { UiLocale } from "@/i18n/locales";
import { UI_LOCALES } from "@/i18n/locales";
import { en } from "./landing.en";
import { es } from "./landing.es";
import { pl } from "./landing.pl";
import { TECHNIQUE_IDS, TECHNIQUES, type TechniqueDef, type TechniqueId } from "./registry";
import type { TechniqueCopy, TechniqueCopyMap } from "./types";

export * from "./registry";
export type { TechniqueCopy, FaqItem } from "./types";

const COPY: Record<UiLocale, TechniqueCopyMap> = { en, pl, es };

export function techniqueCopy(locale: string, id: TechniqueId): TechniqueCopy {
  const map = COPY[(locale in COPY ? locale : "en") as UiLocale];
  return map[id] ?? en[id];
}

export function techniqueName(locale: string, id: string): string {
  return id in TECHNIQUES ? techniqueCopy(locale, id as TechniqueId).name : id;
}

export interface LandingEntry {
  locale: UiLocale;
  technique: TechniqueDef;
  copy: TechniqueCopy;
  slug: string;
}

/** All landing pages that exist. Only techniques flagged `landing` with complete copy are published. */
export function landingEntries(): LandingEntry[] {
  const out: LandingEntry[] = [];
  for (const locale of UI_LOCALES) {
    for (const id of TECHNIQUE_IDS) {
      const technique = TECHNIQUES[id];
      const copy = COPY[locale][id];
      if (!technique.landing || !copy?.slug || !copy.h1 || !copy.intro || !copy.faq) continue;
      out.push({ locale, technique, copy, slug: copy.slug });
    }
  }
  return out;
}

export type SlugResolution =
  | { kind: "page"; entry: LandingEntry }
  | { kind: "alias"; canonicalSlug: string }
  | null;

export function resolveLandingSlug(locale: string, slug: string): SlugResolution {
  const entries = landingEntries().filter((e) => e.locale === locale);
  const page = entries.find((e) => e.slug === slug);
  if (page) return { kind: "page", entry: page };
  const alias = entries.find((e) => e.copy.aliases?.includes(slug));
  if (alias) return { kind: "alias", canonicalSlug: alias.slug };
  return null;
}

/** hreflang alternates for a technique — each locale keeps its own natural slug. */
export function landingAlternates(id: TechniqueId): Partial<Record<UiLocale, string>> {
  const out: Partial<Record<UiLocale, string>> = {};
  for (const e of landingEntries()) if (e.technique.id === id) out[e.locale] = `/${e.locale}/${e.slug}`;
  return out;
}

export function landingPath(locale: string, id: TechniqueId): string | null {
  const e = landingEntries().find((x) => x.locale === locale && x.technique.id === id);
  return e ? `/${locale}/${e.slug}` : null;
}
