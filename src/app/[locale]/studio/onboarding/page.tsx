import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OnboardingForm } from "@/components/studio/OnboardingForm";
import { getProfessional } from "@/server/auth/session";
import { requireUser } from "@/server/guards";
import { onboardAction } from "../actions";

export default async function Onboarding({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/studio/onboarding`);
  if (await getProfessional(user.id)) redirect(`/${locale}/studio`);
  const t = await getTranslations("studio.onboarding");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="mt-2 text-night/60">{t("subtitle")}</p>
      <div className="mt-8">
        <OnboardingForm action={onboardAction.bind(null, locale)} />
      </div>
    </div>
  );
}
