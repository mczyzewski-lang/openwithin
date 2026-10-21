import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Generator } from "@/components/funnel/Generator";
import { Header } from "@/components/layout/Header";
import { isTechniqueId, techniqueCopy } from "@/content/techniques";
import { getCurrentUser } from "@/server/auth/session";
import { settingsFromProfile } from "@/server/space";
import { generatorTechnique, generatorVoices } from "@/server/ui-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; technique: string }> }) {
  const { locale, technique } = await params;
  if (!isTechniqueId(technique)) return {};
  return { title: `${techniqueCopy(locale, technique).name} · OpenWithin`, robots: { index: false } };
}

/** Generator for any technique (including ones without a landing page). Prefilled for signed-in users. */
export default async function CreateTechniquePage({ params }: { params: Promise<{ locale: string; technique: string }> }) {
  const { locale, technique } = await params;
  setRequestLocale(locale);
  if (!isTechniqueId(technique)) notFound();
  const user = await getCurrentUser();
  const initial = user ? await settingsFromProfile(user.id, technique, locale) : null;
  const copy = techniqueCopy(locale, technique);
  const t = await getTranslations("create");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-10">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-3xl text-ivory sm:text-4xl">{copy.name}</h1>
        <p className="mt-3 text-slate">{copy.short}</p>
        <div className="mt-8">
          <Generator technique={generatorTechnique(locale, technique)} voices={await generatorVoices(locale)} signedIn={!!user} initial={initial ?? undefined} source="create" />
        </div>
      </main>
    </>
  );
}
