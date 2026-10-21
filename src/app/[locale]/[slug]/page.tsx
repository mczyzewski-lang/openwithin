import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { Generator } from "@/components/funnel/Generator";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Faq } from "@/components/ui/Faq";
import { TechniqueIcon } from "@/components/ui/TechniqueIcon";
import { SYSTEM_PROGRAMS } from "@/content/programs";
import { landingAlternates, landingEntries, landingPath, resolveLandingSlug, techniqueCopy } from "@/content/techniques";
import type { UiLocale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/url";
import { generatorTechnique, generatorVoices } from "@/server/ui-data";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return landingEntries().map((e) => ({ locale: e.locale, slug: e.slug }));
}

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const res = resolveLandingSlug(locale, slug);
  if (res?.kind !== "page") return {};
  const { copy, technique } = res.entry;
  const alternates = landingAlternates(technique.id);
  const languages: Record<string, string> = Object.fromEntries(Object.entries(alternates).map(([l, p]) => [l, absoluteUrl(p!)]));
  if (alternates.en) languages["x-default"] = absoluteUrl(alternates.en);
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: { canonical: absoluteUrl(`/${locale}/${slug}`), languages },
    openGraph: { title: copy.metaTitle, description: copy.metaDescription, url: absoluteUrl(`/${locale}/${slug}`), type: "website" },
  };
}

export default async function LandingPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const res = resolveLandingSlug(locale, slug);
  if (!res) notFound();
  if (res.kind === "alias") permanentRedirect(`/${locale}/${res.canonicalSlug}`);
  const { technique, copy } = res.entry;
  const t = await getTranslations("landing");
  const tc = await getTranslations("categories");
  const tp = await getTranslations("phases");
  const voices = await generatorVoices(locale);
  const alternates = landingAlternates(technique.id);

  // "How the session flows" is derived from the technique's real structure.
  const totalWeight = technique.phases.reduce((a, p) => a + p.weight, 0);
  const flow = technique.phases.reduce<{ phase: string; minutes: number }[]>((acc, p) => {
    const minutes = (technique.defaultDuration * p.weight) / totalWeight;
    const last = acc[acc.length - 1];
    if (last?.phase === p.phase) last.minutes += minutes;
    else acc.push({ phase: p.phase, minutes });
    return acc;
  }, []);

  const related = technique.related
    .map((id) => ({ id, path: landingPath(locale, id), copy: techniqueCopy(locale, id) }))
    .filter((r) => r.path);
  const programs = SYSTEM_PROGRAMS.filter((p) => p.days.some((d) => d.technique === technique.id));
  const l = locale as UiLocale;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faq!.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OpenWithin", item: absoluteUrl(`/${locale}`) },
      { "@type": "ListItem", position: 2, name: copy.name, item: absoluteUrl(`/${locale}/${slug}`) },
    ],
  };

  return (
    <>
      <Header alternates={alternates} />
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div className="lg:pt-6">
            <p className="eyebrow inline-flex items-center gap-2">
              <TechniqueIcon name={technique.icon} className="h-4 w-4" /> {tc(technique.category)}
            </p>
            <h1 className="mt-5 text-4xl leading-[1.1] text-ivory sm:text-5xl">{copy.h1}</h1>
            <p className="mt-4 text-lg leading-relaxed text-ivory/75 sm:mt-6">{copy.short}</p>
            <ul className="mt-8 hidden space-y-3 text-sm text-ivory/75 sm:block">
              {[t("point1"), t("point2"), t("point3")].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-champagne" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div id="create" className="scroll-mt-24">
            <Generator technique={generatorTechnique(locale, technique.id)} voices={voices} source={`landing:${slug}`} />
          </div>
        </section>

        <section className="border-t border-ivory/5 bg-night-2/40 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl text-ivory">{t("aboutTitle", { name: copy.name })}</h2>
              <div className="prose-calm mt-6">
                {copy.intro!.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
              {copy.forWhom && (
                <>
                  <h3 className="mt-10 text-xl text-ivory">{t("forWhomTitle")}</h3>
                  <ul className="mt-4 space-y-3">
                    {copy.forWhom.map((w) => (
                      <li key={w} className="flex items-start gap-3 text-ivory/75">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-champagne" /> {w}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div>
              <h2 className="text-3xl text-ivory">{t("flowTitle")}</h2>
              <p className="mt-3 text-sm text-slate">{t("flowSubtitle", { minutes: technique.defaultDuration })}</p>
              <ol className="mt-8 space-y-0">
                {flow.map((f, i) => (
                  <li key={`${f.phase}-${i}`} className="relative flex gap-5 pb-7 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full border border-champagne bg-night" />
                      {i < flow.length - 1 && <span className="mt-1 w-px flex-1 bg-champagne/20" />}
                    </div>
                    <div className="flex-1">
                      <p className="flex items-baseline justify-between gap-4 text-ivory">
                        <span>{tp(`${f.phase}.name`)}</span>
                        <span className="text-xs tabular-nums text-slate">~{Math.max(1, Math.round(f.minutes))} min</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate">{tp(`${f.phase}.body`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-8 rounded-2xl border border-ivory/8 p-4 text-xs leading-relaxed text-slate">{t("safetyNote")}</p>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-5">
            <h2 className="text-3xl text-ivory">{t("faqTitle")}</h2>
            <div className="mt-8">
              <Faq items={copy.faq!} />
            </div>
          </div>
        </section>

        {(related.length > 0 || programs.length > 0) && (
          <section className="border-t border-ivory/5 py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-5">
              <h2 className="text-2xl text-ivory">{t("relatedTitle")}</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <a key={r.id} href={r.path!} className="card group p-6 transition hover:border-champagne/30">
                    <p className="text-ivory">{r.copy.name}</p>
                    <p className="mt-2 text-sm text-slate">{r.copy.short}</p>
                  </a>
                ))}
                {programs.map((p) => (
                  <Link key={p.key} href={`/programs/${p.key}`} className="card group p-6 transition hover:border-champagne/30">
                    <p className="eyebrow">{t("program")}</p>
                    <p className="mt-3 text-ivory">{p.title[l]}</p>
                    <p className="mt-2 text-sm text-slate">{p.description[l]}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm text-champagne/80">
                      {t("programDays", { count: p.days.length })} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="pb-20 text-center">
          <a href="#create" className="btn-primary">
            {t("tryNow", { name: copy.name })}
          </a>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      </main>
      <Footer alternates={alternates} />
    </>
  );
}
