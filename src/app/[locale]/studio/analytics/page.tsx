import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import { requireProfessional } from "@/server/guards";
import { studioAnalytics } from "@/server/studio/service";

export default async function StudioAnalytics({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/analytics`);
  const t = await getTranslations("studio.analytics");
  const a = await studioAnalytics(pro.id, 30);
  const stats: [string, string][] = [
    [t("visits"), String(a.visits)],
    [t("previewPlays"), String(a.previewPlays)],
    [t("checkoutStarts"), String(a.checkoutStarts)],
    [t("purchases"), String(a.purchases)],
    [t("conversion"), `${(a.conversion * 100).toFixed(1)}%`],
    [t("revenue"), a.revenue.length ? a.revenue.map((r) => formatMoney(r.total, r.currency, locale)).join(" · ") : "—"],
    [t("repeatBuyers"), String(a.repeatBuyers)],
  ];
  return (
    <div>
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="mt-2 text-night/60">{t("subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-6">
            <p className="text-sm text-night/60">{label}</p>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs text-night/50">{t("privacy")}</p>
    </div>
  );
}
