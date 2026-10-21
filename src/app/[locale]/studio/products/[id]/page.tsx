import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { techniqueName } from "@/content/techniques";
import { formatMoney } from "@/lib/format";
import { absoluteUrl } from "@/lib/url";
import { db, schema } from "@/server/db";
import { requireProfessional } from "@/server/guards";
import { discountAction, publishAction, shareAction, unpublishAction } from "../../actions";

export default async function ProductAdmin({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale, id } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/products/${id}`);
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.id, id), eq(schema.products.professionalId, pro.id)));
  if (!product) notFound();
  const t = await getTranslations("studio.product");
  const ts = await getTranslations("studio.status");
  const [variants, shares, codes] = await Promise.all([
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, id)),
    db.select().from(schema.shareLinks).where(eq(schema.shareLinks.productId, id)).orderBy(desc(schema.shareLinks.createdAt)),
    db.select().from(schema.discountCodes).where(eq(schema.discountCodes.productId, id)),
  ]);
  const publicUrl = absoluteUrl(`/${pro.slug}/${product.slug}`);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-night/50">{techniqueName(locale, product.techniqueId)} · {t(`type_${product.type}`)} · {product.sessionsCount} × {product.durationMin} min</p>
          <h1 className="mt-2 text-3xl">{product.title}</h1>
          <p className="mt-2 inline-flex rounded-full bg-night/5 px-3 py-1 text-xs uppercase tracking-wider">{ts(product.status)}</p>
          {error && <p className="mt-4 rounded-2xl bg-danger/15 p-3 text-sm">{t(`err_${["ack", "price_required"].includes(error) ? error : "generic"}`)}</p>}
          {product.status === "pending_review" && <p className="mt-4 rounded-2xl border border-night/10 bg-white p-4 text-sm text-night/70">{t("pendingReview")}</p>}
          <p className="mt-6 whitespace-pre-line leading-relaxed text-night/70">{product.description}</p>
        </div>

        <section className="card p-6">
          <h2 className="text-lg">{t("links")}</h2>
          <p className="mt-3 text-sm text-night/60">{t("publicUrl")}</p>
          <a href={`/${pro.slug}/${product.slug}`} className="mt-1 inline-flex items-center gap-1 break-all text-sm underline" target="_blank">{publicUrl} <ExternalLink className="h-3 w-3" /></a>
          <p className="mt-4 text-sm text-night/60">{t("checkoutLink")}</p>
          <p className="mt-1 break-all text-sm">{publicUrl}?buy=1</p>
        </section>

        <section id="share" className="card p-6">
          <h2 className="text-lg">{t("shareTitle")}</h2>
          <p className="mt-2 text-sm text-night/60">{t("shareBody")}</p>
          <form action={shareAction.bind(null, locale, product.id)} className="mt-4 flex flex-wrap gap-3">
            <input name="note" className="input max-w-56 py-2.5 text-sm" placeholder={t("shareNote")} maxLength={60} />
            <input name="maxUses" type="number" min={1} max={100} defaultValue={1} className="input w-24 py-2.5 text-sm" />
            <button className="btn-ghost px-4 py-2.5 text-sm">{t("shareCreate")}</button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {shares.map((s) => (
              <li key={s.id} className="rounded-2xl border border-night/8 p-3">
                <span className="text-night/60">{s.note ?? "—"} · {s.uses}/{s.maxUses}</span>
                <p className="mt-1 break-all">{absoluteUrl(`/${locale}/share/${s.token}`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {!product.isFree && (
          <section id="discounts" className="card p-6">
            <h2 className="text-lg">{t("discountTitle")}</h2>
            <form action={discountAction.bind(null, locale, product.id)} className="mt-4 flex flex-wrap gap-3">
              <input name="code" className="input max-w-40 py-2.5 text-sm uppercase" placeholder="CALM20" required maxLength={30} />
              <input name="percentOff" type="number" min={1} max={100} defaultValue={20} className="input w-24 py-2.5 text-sm" />
              <input name="maxRedemptions" type="number" min={1} className="input w-28 py-2.5 text-sm" placeholder={t("maxUses")} />
              <button className="btn-ghost px-4 py-2.5 text-sm">{t("discountCreate")}</button>
            </form>
            <ul className="mt-4 space-y-1 text-sm text-night/70">
              {codes.map((c) => (
                <li key={c.id}>{c.code} · −{c.percentOff}% · {c.redeemedCount}{c.maxRedemptions ? `/${c.maxRedemptions}` : ""}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
        <div className="card p-6">
          <p className="text-sm text-night/60">{t("price")}</p>
          <p className="mt-1 font-serif text-2xl">{product.isFree ? t("freeLabel") : variants.map((v) => formatMoney(v.amountMinor, v.currency, locale)).join(" · ") || "—"}</p>
          {product.status === "published" ? (
            <form action={unpublishAction.bind(null, locale, product.id)}>
              <button className="btn-ghost mt-6 w-full py-2.5 text-sm">{t("unpublish")}</button>
            </form>
          ) : (
            <form action={publishAction.bind(null, locale, product.id)} className="mt-6 space-y-4">
              <label className="flex items-start gap-3 text-xs leading-relaxed text-night/70">
                <input type="checkbox" name="ack" className="mt-0.5" required /> {t("ack")}
              </label>
              <button className="btn-primary w-full py-2.5 text-sm">{t("publish")}</button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
