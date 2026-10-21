"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

const FIELDS = ["setting", "favorite_place", "intention", "desired_situation", "emotions", "tension_areas", "sleep_sounds", "goal"] as const;

interface Props {
  action: (prev: unknown, fd: FormData) => Promise<{ error?: string; issues?: string[] } | undefined>;
  templates: { id: string; label: string }[];
  preselected?: string;
  clinicalMode: boolean;
}

export function ProductForm({ action, templates, preselected, clinicalMode }: Props) {
  const t = useTranslations("studio.product");
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState<"single" | "program">("single");
  const [days, setDays] = useState<string[]>([preselected ?? templates[0]?.id ?? ""]);
  const [isFree, setFree] = useState(false);
  if (!templates.length) return <p className="card p-6 text-sm text-night/60">{t("noTemplates")}</p>;
  return (
    <form action={formAction} className="card space-y-6 p-6 sm:p-8">
      {state?.error && <p className="rounded-2xl bg-danger/15 p-3 text-sm">{t("error")} {state.issues?.join(", ")}</p>}
      <div className="flex gap-2">
        {(["single", "program"] as const).map((x) => (
          <button key={x} type="button" className="chip" data-active={type === x} onClick={() => setType(x)}>{t(`type_${x}`)}</button>
        ))}
        <input type="hidden" name="type" value={type} />
      </div>
      <div>
        <label className="label">{t("title")}</label>
        <input name="title" required className="input" maxLength={120} placeholder={t("titlePlaceholder")} />
      </div>
      <div>
        <label className="label">{t("slug")}</label>
        <input name="slug" className="input" maxLength={60} placeholder="7-days-relaxation" pattern="[a-z0-9-]*" />
      </div>
      <div>
        <label className="label">{t("description")}</label>
        <textarea name="description" required minLength={20} className="input min-h-32" maxLength={3000} />
      </div>
      <div className="space-y-3">
        <label className="label">{type === "program" ? t("days") : t("session")}</label>
        {(type === "program" ? days : days.slice(0, 1)).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            {type === "program" && <span className="w-14 text-sm text-night/50">{t("day", { n: i + 1 })}</span>}
            <select name="templateIds" className="input" value={d} onChange={(e) => setDays((x) => x.map((v, k) => (k === i ? e.target.value : v)))}>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.label}</option>
              ))}
            </select>
          </div>
        ))}
        {type === "program" && (
          <button type="button" className="text-sm text-night/60 underline" onClick={() => setDays((x) => [...x, x[x.length - 1]])}>
            {t("addDay")}
          </button>
        )}
      </div>
      <div>
        <label className="label">{t("personalization")}</label>
        <div className="flex flex-wrap gap-3 text-sm">
          {FIELDS.map((f) => (
            <label key={f} className="inline-flex items-center gap-2">
              <input type="checkbox" name="personalizationFields" value={f} /> {t(`field_${f}`)}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-night/50">{t("personalizationHint")}</p>
      </div>
      <div className="space-y-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="isFree" checked={isFree} onChange={(e) => setFree(e.target.checked)} /> {t("free")}
        </label>
        {clinicalMode && <p className="text-xs text-night/50">{t("clinicalShare")}</p>}
        {!isFree && (
          <div className="grid grid-cols-3 gap-3">
            {(["pln", "eur", "usd"] as const).map((c) => (
              <div key={c}>
                <label className="label uppercase">{c}</label>
                <input name={`price_${c}`} type="number" min={0} step="0.01" className="input" placeholder={c === "pln" ? "79" : c === "eur" ? "19" : "19"} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="label">{t("visibility")}</label>
        <select name="visibility" className="input" defaultValue={clinicalMode ? "private" : "public"}>
          <option value="public">{t("vis_public")}</option>
          <option value="unlisted">{t("vis_unlisted")}</option>
          <option value="private">{t("vis_private")}</option>
        </select>
      </div>
      <button className="btn-primary" disabled={pending}>{t("create")}</button>
    </form>
  );
}
