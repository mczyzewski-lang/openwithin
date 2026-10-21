import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Layers, ShieldCheck, UserRound } from "lucide-react";
import { ProductFunnel } from "@/components/funnel/ProductFunnel";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import type { QuestionId } from "@/content/techniques/registry";
import { techniqueName } from "@/content/techniques";
import { formatMoney } from "@/lib/format";
import { absoluteUrl } from "@/lib/url";
import { track } from "@/server/analytics/events";
import { getAnonId, getCurrentUser } from "@/server/auth/session";
import { currencyForMarket, marketForLocale } from "@/server/billing/pricing";
import { db, schema } from "@/server/db";
import { productBySlugs } from "@/server/store";
import { grantFreeAccess, priceProduct } from "@/server/studio/products";
import { generatorTechnique, generatorVoices } from "@/server/ui-data";

export const dynamic = "force-dynamic";

const FIELD_TO_QUESTION: Record<string, QuestionId> = {
  setting: "setting",
  favorite_place: "favorite_place",
  intention: "intention",
  desired_situation: "desired_situation",
  emotions: "emotions",
  tension_areas: "tension_areas",
  sleep_sounds: "sleep_sounds",
  goal: "goal",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string; pro: string; product: string }> }) {
  const { pro, product } = await params;
  const data = await productBySlugs(pro, product);
  if (!data || data.product.status !== "published") return {};
  return {
    title: `${data.product.title} · ${data.pro.displayName}`,
    description: data.product.description.slice(0, 155),
    alternates: { canonical: absoluteUrl(`/${pro}/${product}`) },
    robots: data.product.visibility === "public" ? undefined : { index: false },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; pro: string; product: string }> }) {
  const { locale, pro: proSlug, product: productSlug } = await params;
  setRequestLocale(locale);
  const data = await productBySlugs(proSlug, productSlug);
  if (!data || data.product.status !== "published" || data.product.visibility === "private") notFound();
  const { pro, product } = data;
  const t = await getTranslations("store");
  const user = await getCurrentUser();
  const market = marketForLocale(locale, (await cookies()).get("ow_market")?.value);
  const priced = product.isFree ? null : await priceProduct(product, currencyForMarket(market));
  const [access] = user
    ? await db.select().from(schema.entitlements).where(and(eq(schema.entitlements.userId, user.id), eq(schema.entitlements.productId, product.id), isNull(schema.entitlements.revokedAt)))
    : [];
  await track("product_view", { userId: user?.id, anonId: await getAnonId(), productId: product.id, professionalId: pro.id, techniqueId: product.techniqueId, locale });

  async function claimFree(_draftId: string) {
    "use server";
    const me = await getCurrentUser();
    if (!me) return { error: "unauthorized" };
    if (!product.isFree) return { error: "not_free" };
    await grantFreeAccess(me.id, product, "purchase");
    return { draftId: _draftId };
  }

  const technique = generatorTechnique(product.language, product.techniqueId as never);
  const questions = product.personalizationFields.map((f) => FIELD_TO_QUESTION[f]).filter(Boolean);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    brand: { "@type": "Person", name: pro.displayName },
    ...(priced ? { offers: { "@type": "Offer", price: (priced.amountMinor / 100).toFixed(2), priceCurrency: priced.currency.toUpperCase(), url: absoluteUrl(`/${pro.slug}/${product.slug}`) } } : {}),
  };
  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <a href={`/${pro.slug}`} className="inline-flex items-center gap-3 text-sm text-slate hover:text-champagne">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-night" style={{ background: pro.brandColor ?? "#d8c7a7" }}>{pro.displayName.slice(0, 1)}</span>
            {pro.displayName}
          </a>
          <h1 className="mt-6 text-4xl leading-tight text-ivory sm:text-5xl">{product.title}</h1>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-ivory/75">{product.description}</p>
          <ul className="mt-8 space-y-3 text-sm text-ivory/80">
            <li className="flex items-center gap-3"><Layers className="h-4 w-4 text-champagne" /> {product.type === "program" ? t("programDays", { count: product.sessionsCount }) : t("single")} · {techniqueName(locale, product.techniqueId)}</li>
            <li className="flex items-center gap-3"><Clock className="h-4 w-4 text-champagne" /> {t("upTo", { minutes: product.durationMin })} · {product.language.toUpperCase()}</li>
            <li className="flex items-center gap-3"><UserRound className="h-4 w-4 text-champagne" /> {t("personalized")}</li>
          </ul>
          {pro.credentials && <p className="mt-8 text-sm text-slate">{pro.credentials}</p>}
          <p className="mt-8 flex items-start gap-3 rounded-2xl border border-ivory/8 p-4 text-xs leading-relaxed text-slate">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-champagne" /> {t("disclaimer", { author: pro.displayName })}
          </p>
        </div>
        <div>
          <ProductFunnel
            productId={product.id}
            technique={technique}
            voices={await generatorVoices(product.language)}
            questions={questions}
            locked={{ recordingLanguage: product.language, durationMin: product.durationMin }}
            price={priced ? formatMoney(priced.amountMinor, priced.currency, locale) : null}
            isFree={product.isFree}
            hasAccess={!!access}
            mode="buy"
            productPath={`/${locale}/store/${pro.slug}/${product.slug}`}
            claimFree={claimFree}
          />
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      </main>
      <Footer />
    </>
  );
}
