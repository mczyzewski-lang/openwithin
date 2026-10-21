import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { techniqueName } from "@/content/techniques";
import { formatMoney } from "@/lib/format";
import { absoluteUrl } from "@/lib/url";
import { storefront } from "@/server/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; pro: string }> }) {
  const { pro } = await params;
  const data = await storefront(pro);
  if (!data) return {};
  return { title: `${data.pro.displayName} · OpenWithin`, description: data.pro.headline ?? undefined, alternates: { canonical: absoluteUrl(`/${data.pro.slug}`) } };
}

export default async function Storefront({ params }: { params: Promise<{ locale: string; pro: string }> }) {
  const { locale, pro: slug } = await params;
  setRequestLocale(locale);
  const data = await storefront(slug);
  if (!data || data.store?.isPublic === false) notFound();
  const t = await getTranslations("store");
  const accent = data.pro.brandColor ?? "#d8c7a7";
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-12">
        <div className="flex items-center gap-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-full font-serif text-2xl text-night" style={{ background: accent }}>
            {data.pro.displayName.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-3xl text-ivory sm:text-4xl">{data.pro.displayName}</h1>
            {data.pro.headline && <p className="mt-1 text-slate">{data.pro.headline}</p>}
          </div>
        </div>
        {data.pro.bio && <p className="mt-8 max-w-2xl whitespace-pre-line leading-relaxed text-ivory/75">{data.pro.bio}</p>}
        {data.pro.credentials && <p className="mt-4 text-sm text-slate">{data.pro.credentials}</p>}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {data.products.map((p) => {
            const v = data.variants.filter((x) => x.productId === p.id);
            return (
              <a key={p.id} href={`/${data.pro.slug}/${p.slug}`} className="card p-6 transition hover:border-champagne/30">
                <p className="eyebrow">{techniqueName(locale, p.techniqueId)}</p>
                <p className="mt-3 text-lg text-ivory">{p.title}</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate">{p.description}</p>
                <p className="mt-4 text-sm text-champagne">{p.isFree ? t("free") : v.map((x) => formatMoney(x.amountMinor, x.currency, locale)).join(" · ")}</p>
              </a>
            );
          })}
          {!data.products.length && <p className="text-slate">{t("empty")}</p>}
        </div>
      </main>
      <Footer />
    </>
  );
}
