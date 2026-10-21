import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/url";
import { db, schema } from "@/server/db";
import { requireProfessional } from "@/server/guards";

export default async function StudioStore({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/store`);
  const t = await getTranslations("studio.store");
  const products = await db.select().from(schema.products).where(eq(schema.products.professionalId, pro.id));
  return (
    <div>
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="mt-2 text-night/60">{t("subtitle")}</p>
      <div className="card mt-8 p-6">
        <p className="text-sm text-night/60">{t("storefront")}</p>
        <a href={`/${pro.slug}`} target="_blank" className="mt-1 inline-flex items-center gap-1 break-all underline">
          {absoluteUrl(`/${pro.slug}`)} <ExternalLink className="h-3 w-3" />
        </a>
        <p className="mt-4 text-sm text-night/60">{t("brandingHint")}</p>
        <Link href="/studio/settings" className="mt-2 inline-block text-sm underline">{t("editBranding")}</Link>
      </div>
      <div className="mt-8 divide-y divide-night/8 rounded-3xl border border-night/8 bg-white">
        {products.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p>{p.title}</p>
              <p className="text-xs text-night/50">{absoluteUrl(`/${pro.slug}/${p.slug}`)} · {p.visibility}</p>
            </div>
            <Link href={`/studio/products/${p.id}`} className="text-sm underline">{t("manage")}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
