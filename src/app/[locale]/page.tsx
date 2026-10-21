import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, AudioLines, Clock, Hourglass, Mic, Music, UserRound } from "lucide-react";
import { InnerStory } from "@/components/funnel/InnerStory";
import { QuickStart } from "@/components/funnel/QuickStart";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { BreathingLight } from "@/components/ui/BreathingLight";
import { Particles } from "@/components/ui/Particles";
import { TechniqueIcon } from "@/components/ui/TechniqueIcon";
import { landingEntries, type TechniqueId } from "@/content/techniques";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/url";
import { generatorTechnique, generatorVoices } from "@/server/ui-data";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const languages = Object.fromEntries(routing.locales.map((l) => [l, absoluteUrl(`/${l}`)]));
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: absoluteUrl(`/${locale}`), languages: { ...languages, "x-default": absoluteUrl("/en") } },
    openGraph: { title: t("title"), description: t("description"), url: absoluteUrl(`/${locale}`) },
  };
}

const QUICK: TechniqueId[] = ["guided_meditation", "sleep_meditation", "pmr", "yoga_nidra", "goal_visualization", "guided_breathing"];

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const voices = await generatorVoices(locale);
  const popular = landingEntries().filter((e) => e.locale === locale && e.technique.popular);

  const adapts = [
    { icon: Mic, key: "voice" },
    { icon: AudioLines, key: "narration" },
    { icon: Clock, key: "duration" },
    { icon: Hourglass, key: "pauses" },
    { icon: Music, key: "music" },
    { icon: UserRound, key: "details" },
  ] as const;

  return (
    <>
      <Header transparent />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <Particles />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-28 sm:pt-36 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
            <div className="animate-fade-up">
              <div className="mb-8 lg:hidden">
                <BreathingLight size={120} />
              </div>
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="mt-5 text-[2.6rem] leading-[1.05] text-ivory sm:text-6xl lg:text-7xl">{t("heroTitle")}</h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-ivory/75">{t("heroSubtitle")}</p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href="#create" className="btn-primary">
                  {t("ctaPrimary")} <ArrowRight className="h-4 w-4" />
                </a>
                <Link href="/explore" className="btn-ghost">
                  {t("ctaSecondary")}
                </Link>
              </div>
              <p className="mt-5 text-sm text-slate">{t("heroNote")}</p>
            </div>
            <div className="hidden lg:block">
              <InnerStory captions={[t("story1"), t("story2"), t("story3"), t("story4")]} videoUrl={process.env.NEXT_PUBLIC_HERO_VIDEO_URL} />
            </div>
          </div>
        </section>

        {/* Generator — the primary action */}
        <section id="create" className="scroll-mt-20 bg-night-2/50 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl px-5">
            <p className="eyebrow text-center">{t("createEyebrow")}</p>
            <h2 className="mt-4 text-center text-3xl text-ivory sm:text-4xl">{t("createTitle")}</h2>
            <p className="mx-auto mt-4 max-w-md text-center text-slate">{t("createSubtitle")}</p>
            <div className="mt-10">
              <QuickStart techniques={QUICK.map((id) => generatorTechnique(locale, id))} voices={voices} />
            </div>
          </div>
        </section>

        {/* Story on mobile */}
        <section className="px-5 py-16 lg:hidden">
          <InnerStory captions={[t("story1"), t("story2"), t("story3"), t("story4")]} videoUrl={process.env.NEXT_PUBLIC_HERO_VIDEO_URL} />
        </section>

        {/* A voice that knows your story */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl">
              <p className="eyebrow">{t("knowsEyebrow")}</p>
              <h2 className="mt-4 text-3xl leading-tight text-ivory sm:text-5xl">{t("knowsTitle")}</h2>
              <p className="mt-6 text-lg leading-relaxed text-ivory/70">{t("knowsBody")}</p>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adapts.map(({ icon: Icon, key }) => (
                <div key={key} className="card p-6">
                  <Icon className="h-5 w-5 text-champagne" strokeWidth={1.5} aria-hidden />
                  <p className="mt-5 text-ivory">{t(`adapt.${key}.title`)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{t(`adapt.${key}.body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="border-y border-ivory/5 bg-night-2/40 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-3">
            {(["space", "guidance", "personalization"] as const).map((k, i) => (
              <div key={k}>
                <p className="font-serif text-5xl text-champagne/40">0{i + 1}</p>
                <p className="mt-4 eyebrow">{t(`pillars.${k}.name`)}</p>
                <p className="mt-3 text-lg leading-relaxed text-ivory/80">{t(`pillars.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Popular experiences */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex items-end justify-between gap-6">
              <h2 className="text-3xl text-ivory sm:text-4xl">{t("popularTitle")}</h2>
              <Link href="/explore" className="hidden text-sm text-champagne hover:text-ivory sm:inline">
                {t("seeAll")}
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map((e) => (
                <a key={e.slug} href={`/${locale}/${e.slug}`} className="card group p-6 transition hover:border-champagne/30">
                  <TechniqueIcon name={e.technique.icon} className="h-5 w-5 text-champagne" />
                  <p className="mt-5 text-lg text-ivory">{e.copy.name}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{e.copy.short}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm text-champagne/80 group-hover:text-champagne">
                    {t("tryIt")} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-night-2/40 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-3xl text-ivory sm:text-4xl">{t("howTitle")}</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="border-t border-champagne/25 pt-5">
                  <p className="text-sm text-champagne">{String(n).padStart(2, "0")}</p>
                  <p className="mt-3 text-ivory">{t(`how${n}.title`)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{t(`how${n}.body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Studio */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="card grid gap-8 p-8 sm:p-12 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <p className="eyebrow">OpenWithin Studio</p>
                <h2 className="mt-4 text-3xl text-ivory sm:text-4xl">{t("studioTitle")}</h2>
                <p className="mt-4 max-w-xl leading-relaxed text-ivory/70">{t("studioBody")}</p>
              </div>
              <div className="flex md:justify-end">
                <Link href="/studio" className="btn-ghost">
                  {t("studioCta")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden py-24 text-center">
          <div className="mx-auto flex max-w-xl flex-col items-center px-5">
            <BreathingLight size={110} />
            <h2 className="mt-8 text-4xl text-ivory sm:text-5xl">{t("finalTitle")}</h2>
            <a href="#create" className="btn-primary mt-10">
              {t("ctaPrimary")}
            </a>
          </div>
        </section>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "OpenWithin",
              url: absoluteUrl("/"),
              slogan: "Close your eyes. Open your world.",
            }),
          }}
        />
      </main>
      <Footer />
    </>
  );
}
