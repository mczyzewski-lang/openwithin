import { and, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductFunnel } from "@/components/funnel/ProductFunnel";
import { Header } from "@/components/layout/Header";
import { getCurrentUser } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { grantFreeAccess } from "@/server/studio/products";
import { generatorTechnique, generatorVoices } from "@/server/ui-data";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** Private share (e.g. psychologist → client): no sale, no public listing. */
export default async function SharePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const [link] = await db.select().from(schema.shareLinks).where(and(eq(schema.shareLinks.token, token), isNull(schema.shareLinks.revokedAt)));
  if (!link || (link.expiresAt && link.expiresAt < new Date())) notFound();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, link.productId));
  const [pro] = await db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.id, link.professionalId));
  if (!product || !pro) notFound();
  const user = await getCurrentUser();
  const [access] = user
    ? await db.select().from(schema.entitlements).where(and(eq(schema.entitlements.userId, user.id), eq(schema.entitlements.productId, product.id), isNull(schema.entitlements.revokedAt)))
    : [];
  const t = await getTranslations("share");

  async function redeem(draftId: string) {
    "use server";
    const me = await getCurrentUser();
    if (!me) return { error: "unauthorized" };
    const [already] = await db.select().from(schema.entitlements).where(and(eq(schema.entitlements.userId, me.id), eq(schema.entitlements.productId, link.productId)));
    if (!already) {
      const used = await db
        .update(schema.shareLinks)
        .set({ uses: sql`${schema.shareLinks.uses} + 1` })
        .where(and(eq(schema.shareLinks.id, link.id), sql`${schema.shareLinks.uses} < ${schema.shareLinks.maxUses}`))
        .returning();
      if (!used.length) return { error: "used_up" };
      await grantFreeAccess(me.id, product!, "share", link.id);
    }
    return { draftId };
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-10">
        <p className="eyebrow">{t("from", { name: pro.displayName })}</p>
        <h1 className="mt-4 text-3xl text-ivory sm:text-4xl">{product.title}</h1>
        <p className="mt-4 whitespace-pre-line text-ivory/75">{product.description}</p>
        <p className="mt-4 text-xs text-slate-2">{t("note")}</p>
        <div className="mt-8">
          <ProductFunnel
            productId={product.id}
            technique={generatorTechnique(product.language, product.techniqueId as never)}
            voices={await generatorVoices(product.language)}
            questions={[]}
            locked={{ recordingLanguage: product.language, durationMin: product.durationMin }}
            price={null}
            isFree
            hasAccess={!!access}
            mode="share"
            productPath={`/${locale}/share/${token}`}
            claimFree={redeem}
          />
        </div>
      </main>
    </>
  );
}
