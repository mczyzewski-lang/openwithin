"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

interface Props {
  action: (prev: unknown, fd: FormData) => Promise<{ error?: string } | undefined>;
  techniques: { category: string; items: { id: string; name: string; durations: number[]; defaultDuration: number; ambient: string }[] }[];
  voices: { id: string; label: string }[];
  ambients: { id: string; label: string }[];
  defaultLanguage: string;
}

export function ComposeForm({ action, techniques, voices, ambients, defaultLanguage }: Props) {
  const t = useTranslations("studio.compose");
  const [state, formAction, pending] = useActionState(action, undefined);
  const all = techniques.flatMap((g) => g.items);
  const [techId, setTechId] = useState(all[0]?.id);
  const tech = all.find((x) => x.id === techId) ?? all[0];
  return (
    <form action={formAction} className="card space-y-5 p-6 sm:p-8">
      {state?.error && <p className="rounded-2xl bg-danger/15 p-3 text-sm">{t("error")}</p>}
      <div>
        <label className="label">{t("name")}</label>
        <input name="title" className="input" required maxLength={120} placeholder={t("namePlaceholder")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("technique")}</label>
          <select name="techniqueId" className="input" value={techId} onChange={(e) => setTechId(e.target.value)}>
            {techniques.map((g) => (
              <optgroup key={g.category} label={g.category}>
                {g.items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("language")}</label>
          <select name="language" className="input" defaultValue={defaultLanguage}>
            <option value="en">English</option>
            <option value="pl">Polski</option>
            <option value="es">Español</option>
          </select>
        </div>
        <div>
          <label className="label">{t("duration")}</label>
          <select name="durationMin" className="input" key={tech.id} defaultValue={tech.defaultDuration}>
            {tech.durations.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("voice")}</label>
          <select name="voicePresetId" className="input">
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("ambient")}</label>
          <select name="ambient" className="input" key={`a-${tech.id}`} defaultValue={tech.ambient}>
            {ambients.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("ambientVolume")}</label>
          <input type="range" name="ambientVolume" min={0} max={60} defaultValue={18} className="w-full accent-[#101823]" />
        </div>
        <div>
          <label className="label">{t("pauses")}</label>
          <select name="pauseLevel" className="input" defaultValue="balanced">
            <option value="short">{t("pause_short")}</option>
            <option value="balanced">{t("pause_balanced")}</option>
            <option value="spacious">{t("pause_spacious")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("style")}</label>
          <select name="style" className="input" defaultValue="gentle">
            <option value="gentle">{t("style_gentle")}</option>
            <option value="grounded">{t("style_grounded")}</option>
            <option value="poetic">{t("style_poetic")}</option>
            <option value="minimal">{t("style_minimal")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">{t("instructions")}</label>
        <textarea name="narratorInstructions" className="input min-h-28" maxLength={1200} placeholder={t("instructionsPlaceholder")} />
        <p className="mt-2 text-xs text-night/50">{t("instructionsHint")}</p>
      </div>
      <button className="btn-primary" disabled={pending}>
        <Sparkles className="h-4 w-4" /> {pending ? t("composing") : t("compose")}
      </button>
    </form>
  );
}
