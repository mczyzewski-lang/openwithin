import type { MetadataRoute } from "next";
import { landingAlternates, landingEntries } from "@/content/techniques";
import { SYSTEM_PROGRAMS } from "@/content/programs";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/url";

export const revalidate = 3600;

/** Static marketing pages + every localized landing page with hreflang alternates + public products. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const locales = routing.locales;
  const perLocale = (path: string, priority: number): MetadataRoute.Sitemap =>
    locales.map((l) => ({
      url: absoluteUrl(`/${l}${path}`),
      lastModified: now,
      priority,
      alternates: { languages: Object.fromEntries(locales.map((x) => [x, absoluteUrl(`/${x}${path}`)])) },
    }));

  const landings: MetadataRoute.Sitemap = landingEntries().map((e) => ({
    url: absoluteUrl(`/${e.locale}/${e.slug}`),
    lastModified: now,
    priority: 0.9,
    alternates: { languages: Object.fromEntries(Object.entries(landingAlternates(e.technique.id)).map(([l, p]) => [l, absoluteUrl(p!)])) },
  }));

  let products: MetadataRoute.Sitemap = [];
  try {
    const { db, schema } = await import("@/server/db");
    const { and, eq } = await import("drizzle-orm");
    const rows = await db
      .select({ pro: schema.professionalProfiles.slug, slug: schema.products.slug, updated: schema.products.updatedAt })
      .from(schema.products)
      .innerJoin(schema.professionalProfiles, eq(schema.professionalProfiles.id, schema.products.professionalId))
      .where(and(eq(schema.products.status, "published"), eq(schema.products.visibility, "public")));
    products = rows.map((r) => ({ url: absoluteUrl(`/${r.pro}/${r.slug}`), lastModified: r.updated, priority: 0.6 }));
  } catch {
    // database unavailable during build — products are added on the next revalidation
  }

  return [
    ...perLocale("", 1),
    ...perLocale("/explore", 0.8),
    ...perLocale("/studio", 0.6),
    ...SYSTEM_PROGRAMS.flatMap((p) => perLocale(`/programs/${p.key}`, 0.6)),
    ...landings,
    ...products,
  ];
}
