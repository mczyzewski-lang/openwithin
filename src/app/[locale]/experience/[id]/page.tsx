import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { ExperienceActions } from "@/components/player/ExperienceActions";
import { PlayerStage } from "@/components/player/PlayerStage";
import { Upsell } from "@/components/funnel/Upsell";
import { Header } from "@/components/layout/Header";
import { techniqueName } from "@/content/techniques";
import { creditSummary } from "@/server/billing/entitlements";
import { marketForLocale, offersForMarket } from "@/server/billing/pricing";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function ExperiencePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ fresh?: string; checkout?: string }> }) {
  const { locale, id } = await params;
  const { fresh, checkout } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/experience/${id}`);
  const [row] = await db
    .select({ item: schema.experienceLibrary, audio: schema.generatedAudio, scenario: schema.audioScenarios })
    .from(schema.experienceLibrary)
    .innerJoin(schema.generatedAudio, eq(schema.generatedAudio.id, schema.experienceLibrary.generatedAudioId))
    .innerJoin(schema.audioScenarios, eq(schema.audioScenarios.id, schema.generatedAudio.scenarioId))
    .where(and(eq(schema.experienceLibrary.id, id), eq(schema.experienceLibrary.userId, user.id)));
  if (!row) notFound();
  const t = await getTranslations("experience");
  const market = marketForLocale(locale, (await cookies()).get("ow_market")?.value);
  const [offers, credits] = await Promise.all([offersForMarket(market), creditSummary(user.id)]);
  const isPreview = row.audio.kind === "preview";

  return (
    <>
      <Header />
      <main className="pb-20">
        <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,#1c2837_0%,#101823_65%)]">
          <div className="mx-auto max-w-xl px-5 pb-14 pt-12 text-center sm:pt-16">
            <p className="eyebrow">{techniqueName(locale, row.scenario.techniqueId)}</p>
            <h1 className="mt-4 text-3xl text-ivory sm:text-4xl">{row.item.title}</h1>
            <p className="mt-2 text-sm text-slate">
              {isPreview ? t("previewLabel") : t("minutes", { count: Math.round(row.audio.durationMs / 60000) })}
              {fresh ? ` · ${t("freshNote")}` : ""}
            </p>
            {checkout && <p className="mx-auto mt-4 max-w-sm rounded-2xl border border-champagne/30 p-3 text-sm text-champagne">{t("purchaseThanks")}</p>}
            <div className="mt-10">
              <PlayerStage
                src={`/api/audio/${row.audio.id}`}
                title={row.item.title}
                libraryId={row.item.id}
                initialPositionMs={row.item.lastPositionMs}
                demo={row.audio.isDemoAudio}
              />
            </div>
            <p className="mx-auto mt-8 max-w-sm text-xs leading-relaxed text-slate-2">{t("stopAnytime")}</p>
            <div className="mt-8">
              <ExperienceActions libraryId={row.item.id} isFavorite={row.item.isFavorite} saved={row.item.saved} />
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-5 pt-12">
          <Upsell
            offers={offers}
            draftId={row.scenario.draftId}
            currentMinutes={Math.round(row.audio.durationMs / 60000)}
            credits={credits}
            isProduct={!!row.scenario.productId}
            returnPath={`/${locale}/experience/${id}`}
          />
        </section>
      </main>
    </>
  );
}
