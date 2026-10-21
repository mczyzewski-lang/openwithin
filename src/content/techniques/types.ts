import type { TechniqueId } from "./registry";

export interface FaqItem {
  q: string;
  a: string;
}

export interface TechniqueCopy {
  name: string;
  short: string;
  /** Landing page fields — required when registry.landing is true. */
  slug?: string;
  /** Alternative search-intent slugs that 308-redirect to the canonical slug (no duplicate pages). */
  aliases?: string[];
  h1?: string;
  metaTitle?: string;
  metaDescription?: string;
  intro?: string[];
  forWhom?: string[];
  faq?: FaqItem[];
}

export type TechniqueCopyMap = Record<TechniqueId, TechniqueCopy>;
