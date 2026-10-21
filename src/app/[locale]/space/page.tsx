import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Heart, Moon, Play, Sparkles, Sun, Target, Waves, Zap, Map } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TechniqueIcon } from "@/components/ui/TechniqueIcon";
import { getSystemProgram } from "@/content/programs";
import { getTechnique, MOODS, type Mood } from "@/content/techniques";
import type { UiLocale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { formatDuration } from "@/lib/format";
import { track } from "@/server/analytics/events";
import { creditSummary } from "@/server/billing/entitlements";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/guards";
import { activePrograms } from "@/server/programs";
import { continueListening, createDraftFor, libraryItems, pickTechniqueForMood, settingsFromProfile } from "@/server/space";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const MOOD_ICONS: Record<Mood, typeof Sun> = { relax: Waves, sleep: Moon, focus: Target, visualize: Sparkles, recharge: Zap };

export default async function SpacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/space`);
  const t = await getTranslations("space");
  const l = locale as UiLocale;

  // Return-visit tracking (D1/D7/D30 retention is computed from these + listening events).
  const now = new Date();
  if (!user.lastSeenAt || now.getTime() - user.lastSeenAt.getTime() > 6 * 3600_000) {
    await db.update(schema.users).set({ lastSeenAt: now }).where(eq(schema.users.id, user.id));
    if (user.lastSeenAt) await track("return_visit", { userId: user.id, props: { daysSinceSignup: Math.floor((now.getTime() - user.createdAt.getTime()) / 86400_000) } });
  }

  const [[profile], items, cont, programs, credits] = await Promise.all([
    db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)),
    libraryItems(user.id),
    continueListening(user.id),
    activePrograms(user.id),
    creditSummary(user.id),
  ]);
  const firstName = profile?.firstName;
  const sessions = items.filter((i) => i.audio.kind === "full" && i.item.saved);
  const previews = items.filter((i) => i.audio.kind === "preview");
  const favorites = items.filter((i) => i.item.isFavorite);
  const activeProgram = programs.find((p) => !p.progress.completedAt);

  async function quickStart(formData: FormData) {
    "use server";
    const mood = String(formData.get("mood")) as Mood;
    if (!(mood in MOODS)) return;
    const technique = await pickTechniqueForMood(user.id, mood);
    const settings = await settingsFromProfile(user.id, technique, locale);
    if (!settings) redirect(`/${locale}/create/${technique}`);
    const draft = await createDraftFor(user.id, settings, locale);
    redirect(`/${locale}/continue/${draft.id}`);
  }

  async function continueProgram() {
    "use server";
    if (!activeProgram) redirect(`/${locale}/explore#programs`);
    redirect(`/${locale}/programs/${activeProgram.program.key ?? activeProgram.program.id}`);
  }

  const Row = ({ list }: { list: typeof items }) => (
    <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
      {list.map(({ item, audio }) => (
        <Link key={item.id} href={`/experience/${item.id}`} className="card group w-60 shrink-0 p-5 transition hover:border-champagne/30">
          <TechniqueIcon name={getTechnique(item.techniqueId)?.icon ?? "Circle"} className="h-4 w-4 text-champagne" />
          <p className="mt-4 line-clamp-2 text-ivory">{item.title}</p>
          <p className="mt-1 text-xs text-slate">
            {formatDuration(audio.durationMs)} {item.playCount > 0 && `· ${t("plays", { count: item.playCount })}`}
          </p>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-3xl text-ivory sm:text-4xl">{firstName ? t("welcome", { name: firstName }) : t("welcomeAnon")}</h1>

        <section className="mt-10">
          <h2 className="font-serif text-xl text-ivory/90">{t("feel")}</h2>
          <form action={quickStart} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(MOODS) as Mood[]).map((m) => {
              const Icon = MOOD_ICONS[m];
              return (
                <button key={m} name="mood" value={m} className="card flex items-center gap-3 p-4 text-left transition hover:border-champagne/40">
                  <Icon className="h-5 w-5 text-champagne" strokeWidth={1.5} />
                  <span className="text-ivory">{t(`moods.${m}`)}</span>
                </button>
              );
            })}
            <button formAction={continueProgram} className="card flex items-center gap-3 p-4 text-left transition hover:border-champagne/40">
              <Map className="h-5 w-5 text-champagne" strokeWidth={1.5} />
              <span className="text-ivory">{t("moods.program")}</span>
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-2">
            {credits.total > 0 ? t("credits", { count: credits.total, minutes: credits.maxDurationMin }) : t("noCredits")}{" "}
            <Link href="/plans" className="text-champagne hover:underline">{t("plans")}</Link>
          </p>
        </section>

        {cont && (
          <section className="mt-12">
            <h2 className="eyebrow">{t("continueListening")}</h2>
            <Link href={`/experience/${cont.item.id}`} className="card mt-4 flex items-center gap-5 p-5 transition hover:border-champagne/30">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-champagne text-night"><Play className="h-5 w-5 translate-x-0.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-ivory">{cont.item.title}</p>
                <div className="mt-2 h-[3px] rounded-full bg-ivory/10">
                  <div className="h-full rounded-full bg-champagne" style={{ width: `${(cont.item.lastPositionMs / cont.audio.durationMs) * 100}%` }} />
                </div>
              </div>
            </Link>
          </section>
        )}

        {programs.length > 0 && (
          <section className="mt-12">
            <h2 className="eyebrow">{t("myPrograms")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {programs.map(({ program, progress }) => {
                const sys = program.key ? getSystemProgram(program.key) : null;
                return (
                  <Link key={program.id} href={`/programs/${program.key ?? program.id}`} className="card p-5 transition hover:border-champagne/30">
                    <p className="text-ivory">{sys ? sys.title[l] : program.title}</p>
                    <p className="mt-1 text-xs text-slate">{t("programProgress", { done: progress.completedDays.length, total: program.days })}</p>
                    <div className="mt-3 h-[3px] rounded-full bg-ivory/10">
                      <div className="h-full rounded-full bg-champagne" style={{ width: `${(progress.completedDays.length / program.days) * 100}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">{t("myExperiences")}</h2>
            <Link href="/create" className="text-sm text-champagne hover:text-ivory">{t("createNew")}</Link>
          </div>
          <div className="mt-4">{sessions.length ? <Row list={sessions} /> : <p className="text-sm text-slate">{t("emptyExperiences")}</p>}</div>
        </section>

        {favorites.length > 0 && (
          <section className="mt-12">
            <h2 className="eyebrow inline-flex items-center gap-2"><Heart className="h-3.5 w-3.5" /> {t("favorites")}</h2>
            <div className="mt-4"><Row list={favorites} /></div>
          </section>
        )}

        {previews.length > 0 && (
          <section className="mt-12">
            <h2 className="eyebrow">{t("previews")}</h2>
            <div className="mt-4"><Row list={previews} /></div>
          </section>
        )}

        <section className="mt-14 grid gap-3 sm:grid-cols-2">
          <Link href="/explore" className="card flex items-center justify-between p-6 transition hover:border-champagne/30">
            <div>
              <p className="text-ivory">{t("explore")}</p>
              <p className="mt-1 text-sm text-slate">{t("exploreBody")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-champagne" />
          </Link>
          <Link href="/profile" className="card flex items-center justify-between p-6 transition hover:border-champagne/30">
            <div>
              <p className="text-ivory">{t("profile")}</p>
              <p className="mt-1 text-sm text-slate">{t("profileBody")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-champagne" />
          </Link>
        </section>
        <p className="mt-10 text-xs text-slate-2">{t("noGuilt")}</p>
      </main>
      <Footer />
    </>
  );
}
