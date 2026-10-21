"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

const PROFESSIONS = ["psychologist", "psychotherapist", "coach", "yoga_teacher", "mindfulness_trainer", "wellness", "performance_coach"] as const;

export function OnboardingForm({ action }: { action: (prev: unknown, fd: FormData) => Promise<{ error?: string } | undefined> }) {
  const t = useTranslations("studio.onboarding");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card space-y-5 p-6 sm:p-8">
      {state?.error && <p className="rounded-2xl bg-danger/15 p-3 text-sm">{t(`error_${state.error === "slug_unavailable" ? "slug" : "generic"}`)}</p>}
      <div>
        <label className="label">{t("displayName")}</label>
        <input name="displayName" className="input" required maxLength={80} placeholder="Anna Kowalska" />
      </div>
      <div>
        <label className="label">{t("slug")}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-night/50">openwithin.app/</span>
          <input name="slug" className="input" maxLength={60} placeholder="anna-kowalska" pattern="[a-z0-9-]+" />
        </div>
      </div>
      <div>
        <label className="label">{t("profession")}</label>
        <select name="profession" className="input" required>
          {PROFESSIONS.map((p) => (
            <option key={p} value={p}>{t(`prof_${p}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("headline")}</label>
        <input name="headline" className="input" maxLength={140} />
      </div>
      <div>
        <label className="label">{t("bio")}</label>
        <textarea name="bio" className="input min-h-28" maxLength={1500} />
      </div>
      <div>
        <label className="label">{t("credentials")}</label>
        <input name="credentials" className="input" maxLength={300} />
      </div>
      <div>
        <label className="label">{t("website")}</label>
        <input name="website" type="url" className="input" maxLength={200} placeholder="https://" />
      </div>
      <label className="flex items-start gap-3 text-sm text-night/80">
        <input type="checkbox" name="acceptTerms" required className="mt-1" />
        <span>{t("terms")}</span>
      </label>
      <button className="btn-primary" disabled={pending}>{t("submit")}</button>
    </form>
  );
}
