import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/studio/ProductForm";
import { techniqueName } from "@/content/techniques";
import { requireProfessional } from "@/server/guards";
import { templatesForPro } from "@/server/studio/service";
import { createProductAction } from "../../actions";

export default async function NewProduct({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ template?: string }> }) {
  const { locale } = await params;
  const { template } = await searchParams;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/products/new`);
  const t = await getTranslations("studio.product");
  const templates = await templatesForPro(pro.id);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">{t("newTitle")}</h1>
      <p className="mt-2 text-night/60">{t("newSubtitle")}</p>
      {pro.clinicalMode && <p className="mt-4 rounded-2xl border border-night/10 bg-white p-4 text-sm text-night/70">{t("clinicalNote")}</p>}
      <div className="mt-8">
        <ProductForm
          action={createProductAction.bind(null, locale)}
          templates={templates.map((tp) => ({ id: tp.id, label: `${tp.title} · ${techniqueName(locale, tp.techniqueId)} · ${tp.durationMin} min · ${tp.language.toUpperCase()}` }))}
          preselected={template}
          clinicalMode={pro.clinicalMode}
        />
      </div>
    </div>
  );
}
