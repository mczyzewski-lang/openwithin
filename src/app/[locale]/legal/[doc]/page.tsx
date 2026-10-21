import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LEGAL } from "@/content/legal";

export const revalidate = 86400;

export function generateStaticParams() {
  return ["en", "pl", "es"].flatMap((locale) => ["privacy", "terms"].map((doc) => ({ locale, doc })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  const d = LEGAL[locale as "en"]?.[doc as "privacy"];
  return d ? { title: `${d.title} · OpenWithin` } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  const d = LEGAL[locale as "en"]?.[doc as "privacy"];
  if (!d) notFound();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-12">
        <h1 className="text-4xl text-ivory">{d.title}</h1>
        <p className="mt-2 text-sm text-slate-2">{d.updated}</p>
        {d.sections.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="text-xl text-ivory">{s.h}</h2>
            <div className="prose-calm mt-3">
              {s.p.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
