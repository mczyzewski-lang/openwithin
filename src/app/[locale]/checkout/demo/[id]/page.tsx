import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DemoPayButton } from "@/components/funnel/DemoPayButton";
import { Header } from "@/components/layout/Header";
import { formatMoney } from "@/lib/format";
import { db, schema } from "@/server/db";
import { features } from "@/server/env";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

/** DEMO MODE ONLY — stands in for Stripe Checkout when no Stripe key is configured. */
export default async function DemoCheckout({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!features.demoCheckout) notFound();
  const user = await requireUser(locale, `/${locale}/checkout/demo/${id}`);
  const [cs] = await db.select().from(schema.checkoutSessions).where(and(eq(schema.checkoutSessions.id, id), eq(schema.checkoutSessions.userId, user.id)));
  if (!cs) notFound();
  const t = await getTranslations("checkout");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-5 py-16">
        <div className="card p-8 text-center">
          <p className="eyebrow">{t("demoEyebrow")}</p>
          <p className="mt-4 font-serif text-3xl text-ivory">{formatMoney(cs.amountMinor, cs.currency, locale)}</p>
          <p className="mt-2 text-sm text-slate">{cs.offerId ?? t("product")}</p>
          <p className="mt-6 rounded-2xl border border-champagne/20 p-3 text-xs leading-relaxed text-champagne/80">{t("demoNotice")}</p>
          <div className="mt-6">
            <DemoPayButton checkoutId={cs.id} done={cs.status === "completed"} />
          </div>
        </div>
      </main>
    </>
  );
}
