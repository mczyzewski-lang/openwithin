import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TechniqueIcon } from "@/components/ui/TechniqueIcon";
import { SYSTEM_PROGRAMS } from "@/content/programs";
import { CATEGORIES, landingPath, techniqueCopy, techniquesByCategory } from "@/content/techniques";
import type { UiLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/url";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return {
    title: `${t("title")} · OpenWithin`,
    description: t("subtitle"),
    alternates: { canonical: absoluteUrl(`/${locale}/explore`), languages: Object.fromEntries(routing.locales.map((l) => [l, absoluteUrl(`/${l}/explore`)])) },
  };
}

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("explore");
  const tc = await getTranslations("categories");
  const l = locale as UiLocale;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-12">
        <h1 className="text-4xl text-ivory sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-xl text-lg text-slate">{t("subtitle")}</p>
        {CATEGORIES.map((c) => (
          <section key={c} className="mt-14">
            <h2 className="text-2xl text-ivory">{tc(c)}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {techniquesByCategory(c).map((tech) => {
                const copy = techniqueCopy(locale, tech.id);
                const href = landingPath(locale, tech.id);
                const inner = (
                  <>
                    <TechniqueIcon name={tech.icon} className="h-5 w-5 text-champagne" />
                    <p className="mt-4 text-lg text-ivory">{copy.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate">{copy.short}</p>
                    <p className="mt-4 text-xs text-slate-2">{t("durations", { min: tech.durations[0], max: tech.durations[tech.durations.length - 1] })}</p>
                  </>
                );
                return href ? (
                  <a key={tech.id} href={href} className="card p-6 transition hover:border-champagne/30">{inner}</a>
                ) : (
                  <Link key={tech.id} href={`/create/${tech.id}`} className="card p-6 transition hover:border-champagne/30">{inner}</Link>
                );
              })}
            </div>
          </section>
        ))}
        <section id="programs" className="mt-20 scroll-mt-24">
          <h2 className="text-2xl text-ivory">{t("programsTitle")}</h2>
          <p className="mt-2 text-slate">{t("programsSubtitle")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_PROGRAMS.map((p) => (
              <Link key={p.key} href={`/programs/${p.key}`} className="card group p-6 transition hover:border-champagne/30">
                <p className="eyebrow">{t("days", { count: p.days.length })}</p>
                <p className="mt-3 text-lg text-ivory">{p.title[l]}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate">{p.description[l]}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm text-champagne/80 group-hover:text-champagne">{t("viewProgram")} <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
