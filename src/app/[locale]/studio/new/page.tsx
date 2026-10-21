import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComposeForm } from "@/components/studio/ComposeForm";
import { CATEGORIES, techniqueCopy, techniquesByCategory } from "@/content/techniques";
import { AMBIENTS } from "@/content/options";
import type { UiLocale } from "@/i18n/locales";
import { requireProfessional } from "@/server/guards";
import { features } from "@/server/env";
import { listVoices } from "@/server/voices";
import { composeAction } from "../actions";

export default async function NewExperience({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/new`);
  const t = await getTranslations("studio.compose");
  const tc = await getTranslations("categories");
  const voices = await listVoices("en", pro.id);
  const techniques = CATEGORIES.map((c) => ({
    category: tc(c),
    items: techniquesByCategory(c).map((tech) => ({ id: tech.id, name: techniqueCopy(locale, tech.id).name, durations: tech.durations, defaultDuration: tech.defaultDuration, ambient: tech.defaultAmbient })),
  }));
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="mt-2 text-night/60">{t("subtitle")}</p>
      {!features.llm && <p className="mt-4 rounded-2xl border border-night/10 bg-white p-4 text-sm text-night/60">{t("composerNote")}</p>}
      <div className="mt-8">
        <ComposeForm
          action={composeAction.bind(null, locale)}
          techniques={techniques}
          voices={voices.map((v) => ({ id: v.id, label: v.label }))}
          ambients={AMBIENTS.map((a) => ({ id: a.id, label: a.label[locale as UiLocale] }))}
          defaultLanguage={["en", "pl", "es"].includes(locale) ? locale : "en"}
        />
      </div>
    </div>
  );
}
