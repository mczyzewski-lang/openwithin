import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Play } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TechniqueIcon } from "@/components/ui/TechniqueIcon";
import { getSystemProgram } from "@/content/programs";
import { getTechnique, techniqueName } from "@/content/techniques";
import type { UiLocale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { programByKey, programWithSessions, settingsForProgramDay, startProgram } from "@/server/programs";
import { createDraftFor } from "@/server/space";

export const dynamic = "force-dynamic";

async function load(key: string) {
  return /^[0-9a-f-]{36}$/.test(key) ? programWithSessions(key) : programByKey(key);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  const sys = getSystemProgram(key);
  return sys ? { title: `${sys.title[locale as UiLocale]} · OpenWithin`, description: sys.description[locale as UiLocale] } : {};
}

export default async function ProgramPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const data = await load(key);
  if (!data) notFound();
  const { program, sessions } = data;
  const sys = program.key ? getSystemProgram(program.key) : undefined;
  const l = locale as UiLocale;
  const t = await getTranslations("programs");
  const user = await getCurrentUser();
  const [progress] = user
    ? await db.select().from(schema.programProgress).where(and(eq(schema.programProgress.userId, user.id), eq(schema.programProgress.programId, program.id)))
    : [];

  // Product programmes are only accessible through a purchase or share.
  if (program.professionalId && !progress) notFound();

  async function generateDay(formData: FormData) {
    "use server";
    const me = await getCurrentUser();
    if (!me) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/programs/${key}`)}`);
    const day = Number(formData.get("day"));
    const session = sessions.find((s) => s.dayIndex === day);
    // Studio programmes are paid by the product entitlement; system programmes by session credits.
    const [product] = program.professionalId ? await db.select().from(schema.products).where(eq(schema.products.programId, program.id)) : [];
    await startProgram(me.id, program.id, product?.id);
    const settings = await settingsForProgramDay(me.id, program.id, day, locale);
    if (!settings) redirect(`/${locale}/create/${session?.techniqueId ?? "guided_meditation"}`);
    if (product) settings.recordingLanguage = product.language as typeof settings.recordingLanguage;
    const draft = await createDraftFor(me.id, settings, locale, { programId: program.id, programDay: day, productId: product?.id });
    redirect(`/${locale}/continue/${draft.id}`);
  }

  // Already generated days → replay without regenerating.
  const generated = user
    ? await db
        .select({ id: schema.experienceLibrary.id, day: schema.experienceLibrary.programDay })
        .from(schema.experienceLibrary)
        .where(and(eq(schema.experienceLibrary.userId, user.id), eq(schema.experienceLibrary.programId, program.id)))
    : [];
  const done = new Set(progress?.completedDays ?? []);
  const current = progress?.currentDay ?? 1;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-12">
        <p className="eyebrow">{t("eyebrow", { count: program.days })}</p>
        <h1 className="mt-3 text-4xl text-ivory">{sys ? sys.title[l] : program.title}</h1>
        <p className="mt-4 text-lg text-slate">{sys ? sys.description[l] : program.description}</p>
        {progress && <p className="mt-4 text-sm text-champagne">{t("progress", { done: done.size, total: program.days })}</p>}
        <p className="mt-2 text-xs text-slate-2">{t("noPressure")}</p>
        <ol className="mt-10 space-y-3">
          {sessions.map((s) => {
            const focus = sys?.days[s.dayIndex - 1]?.focus[l] ?? s.title;
            const lib = generated.find((g) => g.day === s.dayIndex);
            return (
              <li key={s.id} className={`card flex items-center gap-4 p-5 ${s.dayIndex === current ? "border-champagne/30" : ""}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${done.has(s.dayIndex) ? "border-champagne bg-champagne text-night" : "border-ivory/20 text-slate"}`}>
                  {done.has(s.dayIndex) ? <Check className="h-4 w-4" /> : s.dayIndex}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ivory">{focus}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate">
                    <TechniqueIcon name={getTechnique(s.techniqueId)?.icon ?? "Circle"} className="h-3 w-3" /> {techniqueName(locale, s.techniqueId)} · {s.durationMin} min
                  </p>
                </div>
                {lib ? (
                  <Link href={`/experience/${lib.id}`} className="btn-ghost px-4 py-2 text-sm"><Play className="h-3.5 w-3.5" /> {t("listen")}</Link>
                ) : (
                  <form action={generateDay}>
                    <input type="hidden" name="day" value={s.dayIndex} />
                    <button className={s.dayIndex === current ? "btn-primary px-4 py-2 text-sm" : "btn-ghost px-4 py-2 text-sm"}>{t("create")}</button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-xs text-slate-2">{t("creditsNote")}</p>
      </main>
      <Footer />
    </>
  );
}
