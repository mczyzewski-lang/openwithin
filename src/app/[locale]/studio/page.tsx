import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { getCurrentUser, getProfessional } from "@/server/auth/session";
import { proOverview } from "@/server/studio/service";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studio" });
  return { title: `OpenWithin Studio · ${t("marketing.title")}`, description: t("marketing.subtitle") };
}

export default async function StudioHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("studio");
  const user = await getCurrentUser();
  const pro = user ? await getProfessional(user.id) : null;

  if (!pro) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <p className="text-xs uppercase tracking-[0.22em] text-night/50">OpenWithin Studio</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">{t("marketing.title")}</h1>
        <p className="mt-6 text-lg leading-relaxed text-night/70">{t("marketing.subtitle")}</p>
        <ul className="mt-10 space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="flex items-start gap-3 text-night/80">
              <Check className="mt-0.5 h-5 w-5 shrink-0" /> {t(`marketing.point${n}`)}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={user ? "/studio/onboarding" : `/login?next=/${locale}/studio/onboarding`} className="btn-primary">
            {t("marketing.cta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-6 text-sm text-night/50">{t("marketing.pricing")}</p>
        <p className="mt-10 rounded-2xl border border-night/10 bg-white p-5 text-sm leading-relaxed text-night/60">{t("marketing.responsibility")}</p>
      </div>
    );
  }

  const o = await proOverview(pro.id);
  const published = o.products.filter((p) => p.status === "published").length;
  const pending = o.payouts.filter((p) => p.status === "accrued");
  return (
    <div>
      <h1 className="text-3xl">{t("overview.title", { name: pro.displayName })}</h1>
      <p className="mt-2 text-night/60">{t("overview.subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("overview.created")} value={String(o.templates.length)} />
        <Stat label={t("overview.published")} value={String(published)} />
        <Stat label={t("overview.sales")} value={String(o.sales.reduce((a, s) => a + s.n, 0))} />
        <Stat label={t("overview.revenue")} value={o.sales.length ? o.sales.map((s) => formatMoney(s.total, s.currency, locale)).join(" · ") : "—"} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat label={t("overview.pendingPayouts")} value={pending.length ? pending.map((p) => formatMoney(p.author, p.currency, locale)).join(" · ") : "—"} />
        <div className="card flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-night/60">{t("overview.quickTitle")}</p>
            <p className="mt-1">{t("overview.quickBody")}</p>
          </div>
          <Link href="/studio/new" className="btn-primary px-5 py-2.5 text-sm">{t("nav.create")}</Link>
        </div>
      </div>
      <h2 className="mt-12 text-xl">{t("overview.recent")}</h2>
      <div className="mt-4 divide-y divide-night/8 rounded-3xl border border-night/8 bg-white">
        {o.products.slice(0, 6).map((p) => (
          <Link key={p.id} href={`/studio/products/${p.id}`} className="flex items-center justify-between gap-4 p-5 hover:bg-night/[0.02]">
            <span>{p.title}</span>
            <span className="text-xs uppercase tracking-wider text-night/50">{t(`status.${p.status}`)}</span>
          </Link>
        ))}
        {!o.products.length && <p className="p-5 text-sm text-night/50">{t("overview.empty")}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-night/60">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </div>
  );
}
