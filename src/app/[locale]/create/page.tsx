import { getTranslations, setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TechniqueIcon } from "@/components/ui/TechniqueIcon";
import { CATEGORIES, techniqueCopy, techniquesByCategory } from "@/content/techniques";
import { Link } from "@/i18n/navigation";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "create" });
  return { title: `${t("title")} · OpenWithin`, description: t("subtitle") };
}

export default async function CreatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("create");
  const tc = await getTranslations("categories");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-12">
        <h1 className="text-4xl text-ivory">{t("title")}</h1>
        <p className="mt-3 max-w-lg text-slate">{t("subtitle")}</p>
        {CATEGORIES.map((c) => (
          <section key={c} className="mt-12">
            <h2 className="eyebrow">{tc(c)}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {techniquesByCategory(c).map((tech) => {
                const copy = techniqueCopy(locale, tech.id);
                return (
                  <Link key={tech.id} href={`/create/${tech.id}`} className="card p-5 transition hover:border-champagne/30">
                    <TechniqueIcon name={tech.icon} className="h-4 w-4 text-champagne" />
                    <p className="mt-3 text-ivory">{copy.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate">{copy.short}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
