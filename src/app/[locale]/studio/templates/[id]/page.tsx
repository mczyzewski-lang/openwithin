import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TemplateEditor } from "@/components/studio/TemplateEditor";
import { getTechnique, techniqueName } from "@/content/techniques";
import { Link } from "@/i18n/navigation";
import { db, schema } from "@/server/db";
import { requireProfessional } from "@/server/guards";
import { validateTemplate } from "@/server/studio/service";
import type { BaseSegment } from "@/server/studio/templates";
import { sampleAction, saveSegmentsAction } from "../../actions";

export default async function TemplatePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/templates/${id}`);
  const [tpl] = await db.select().from(schema.experienceTemplates).where(and(eq(schema.experienceTemplates.id, id), eq(schema.experienceTemplates.professionalId, pro.id)));
  if (!tpl) notFound();
  const t = await getTranslations("studio.editor");
  const base = (tpl.baseSegments as BaseSegment[]) ?? [];
  const validation = validateTemplate(tpl, base);
  const [lastSample] = await db
    .select({ audioId: schema.generatedAudio.id, isDemo: schema.generatedAudio.isDemoAudio })
    .from(schema.generatedAudio)
    .innerJoin(schema.audioScenarios, eq(schema.audioScenarios.id, schema.generatedAudio.scenarioId))
    .where(and(eq(schema.audioScenarios.templateId, tpl.id), eq(schema.generatedAudio.kind, "sample")))
    .orderBy(desc(schema.generatedAudio.createdAt))
    .limit(1);
  const phases = [...new Set(getTechnique(tpl.techniqueId)!.phases.map((p) => p.phase))];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-night/50">{techniqueName(locale, tpl.techniqueId)} · {tpl.language.toUpperCase()} · {tpl.durationMin} min</p>
          <h1 className="mt-2 text-3xl">{tpl.title}</h1>
        </div>
        <Link href={`/studio/products/new?template=${tpl.id}`} className="btn-primary px-5 py-2.5 text-sm">{t("createProduct")}</Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-night/60">{t("help")}</p>
      <div className="mt-8">
        <TemplateEditor
          templateId={tpl.id}
          initial={base}
          phases={phases}
          initialIssues={validation.issues}
          save={saveSegmentsAction}
          requestSample={sampleAction}
          lastSample={lastSample ?? null}
          defaultSampleName={pro.displayName.split(" ")[0]}
        />
      </div>
    </div>
  );
}
