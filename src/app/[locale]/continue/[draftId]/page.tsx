import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FullExperience } from "@/components/funnel/FullExperience";
import { Header } from "@/components/layout/Header";
import { experienceSettingsSchema } from "@/lib/settings";
import { techniqueName } from "@/content/techniques";
import { claimAnonymous, getAnonId } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** Post-login step of the funnel: settings from before sign-in are kept; the full session is generated. */
export default async function ContinuePage({ params, searchParams }: { params: Promise<{ locale: string; draftId: string }>; searchParams: Promise<{ minutes?: string; regenerate?: string }> }) {
  const { locale, draftId } = await params;
  const sp = await searchParams;
  const minutes = sp.minutes ? Math.min(60, Math.max(3, Number(sp.minutes) || 0)) : undefined;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/continue/${draftId}`);
  await claimAnonymous(user.id, await getAnonId());
  const [draft] = await db.select().from(schema.experienceDrafts).where(and(eq(schema.experienceDrafts.id, draftId), eq(schema.experienceDrafts.userId, user.id)));
  if (!draft) notFound();
  const settings = experienceSettingsSchema.parse(draft.settings);
  const t = await getTranslations("continue");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-5 py-12 sm:py-20">
        <p className="eyebrow text-center">{techniqueName(locale, settings.techniqueId)}</p>
        <h1 className="mt-4 text-center text-3xl text-ivory sm:text-4xl">{t("title", { name: settings.firstName })}</h1>
        <p className="mt-3 text-center text-slate">{t("subtitle")}</p>
        <div className="mt-10">
          <FullExperience draftId={draft.id} durationMin={minutes} regenerate={sp.regenerate === "1"} />
        </div>
      </main>
    </>
  );
}
