import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Upsell } from "@/components/funnel/Upsell";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getCurrentUser } from "@/server/auth/session";
import { creditSummary } from "@/server/billing/entitlements";
import { marketForLocale, offersForMarket } from "@/server/billing/pricing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "plans" });
  return { title: `${t("title")} · OpenWithin`, description: t("subtitle") };
}

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("plans");
  const user = await getCurrentUser();
  const offers = await offersForMarket(marketForLocale(locale, (await cookies()).get("ow_market")?.value));
  const credits = user ? await creditSummary(user.id) : { total: 0, maxDurationMin: 0 };
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-12">
        <h1 className="text-center text-4xl text-ivory">{t("title")}</h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-slate">{t("subtitle")}</p>
        <div className="mt-6">
          <Upsell offers={offers} draftId={null} currentMinutes={30} credits={credits} isProduct={false} returnPath={`/${locale}/space`} />
        </div>
        <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-slate-2">{t("note")}</p>
      </main>
      <Footer />
    </>
  );
}
