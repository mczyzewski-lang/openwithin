import { getTranslations, setRequestLocale } from "next-intl/server";
import { techniqueName } from "@/content/techniques";
import { Link } from "@/i18n/navigation";
import { requireProfessional } from "@/server/guards";
import { proOverview } from "@/server/studio/service";

export default async function StudioExperiences({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/experiences`);
  const t = await getTranslations("studio");
  const o = await proOverview(pro.id);
  const drafts = o.products.filter((p) => p.status !== "published");
  const published = o.products.filter((p) => p.status === "published");
  return (
    <div className="space-y-12">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl">{t("experiences.library")}</h1>
          <Link href="/studio/new" className="btn-primary px-5 py-2.5 text-sm">{t("nav.create")}</Link>
        </div>
        <p className="mt-2 text-sm text-night/60">{t("experiences.libraryHint")}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {o.templates.map((tpl) => (
            <Link key={tpl.id} href={`/studio/templates/${tpl.id}`} className="card p-5 hover:border-night/25">
              <p className="text-xs uppercase tracking-wider text-night/50">{techniqueName(locale, tpl.techniqueId)} · {tpl.language.toUpperCase()}</p>
              <p className="mt-2">{tpl.title}</p>
              <p className="mt-1 text-sm text-night/50">{tpl.durationMin} min</p>
            </Link>
          ))}
          {!o.templates.length && <p className="text-sm text-night/50">{t("overview.empty")}</p>}
        </div>
      </section>
      {[["experiences.drafts", drafts], ["experiences.published", published]].map(([label, list]) => (
        <section key={label as string}>
          <h2 className="text-xl">{t(label as "experiences.drafts")}</h2>
          <div className="mt-4 divide-y divide-night/8 rounded-3xl border border-night/8 bg-white">
            {(list as typeof drafts).map((p) => (
              <Link key={p.id} href={`/studio/products/${p.id}`} className="flex items-center justify-between gap-4 p-5 hover:bg-night/[0.02]">
                <span>{p.title} <span className="text-sm text-night/50">· {t(`productType.${p.type}`)}</span></span>
                <span className="text-xs uppercase tracking-wider text-night/50">{t(`status.${p.status}`)}</span>
              </Link>
            ))}
            {!(list as typeof drafts).length && <p className="p-5 text-sm text-night/50">—</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
