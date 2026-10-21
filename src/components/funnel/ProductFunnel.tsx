"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Sparkles } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Generator, type GeneratorTechnique, type GeneratorVoice } from "./Generator";
import type { QuestionId } from "@/content/techniques/registry";
import { useSession } from "../layout/useSession";

interface Props {
  productId: string;
  technique: GeneratorTechnique;
  voices: GeneratorVoice[];
  questions: QuestionId[];
  locked: { recordingLanguage: string; durationMin: number; voicePresetId?: string };
  price: string | null;
  originalPrice?: string | null;
  isFree: boolean;
  hasAccess: boolean;
  mode: "buy" | "share";
  productPath: string;
  claimFree?: (draftId: string) => Promise<{ draftId: string } | { error: string }>;
}

/** Store funnel: personalise → hear the author's opening with your name → sign in → buy → delivered to your library. */
export function ProductFunnel(props: Props) {
  const t = useTranslations("store");
  const locale = useLocale();
  const router = useRouter();
  const session = useSession();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    if (!draftId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: props.productId, draftId, locale, discountCode: code || undefined, returnPath: `/${locale}/space`, digitalContentConsent: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "generic");
    setBusy(false);
  }

  async function freeOrAccess() {
    if (!draftId) return;
    setBusy(true);
    if (props.claimFree && !props.hasAccess) {
      const r = await props.claimFree(draftId);
      if ("error" in r) {
        setError(r.error);
        setBusy(false);
        return;
      }
    }
    router.push(`/continue/${draftId}`);
  }

  const signedIn = !!session?.signedIn;
  return (
    <div className="space-y-6">
      <Generator
        technique={props.technique}
        voices={props.voices}
        productId={props.productId}
        locked={props.locked}
        questionsOverride={props.questions}
        continuePath={`${props.productPath.replace(`/${locale}`, "")}#buy`}
        onPreview={setDraftId}
        source="store"
      />
      {draftId && signedIn && (
        <div id="buy" className="card scroll-mt-24 p-6 sm:p-8">
          {props.hasAccess || props.isFree || props.mode === "share" ? (
            <button className="btn-primary w-full" disabled={busy} onClick={freeOrAccess}>
              <Sparkles className="h-4 w-4" /> {props.hasAccess ? t("createMine") : t("getFree")}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-slate">{t("price")}</span>
                <span className="font-serif text-3xl text-ivory">
                  {props.originalPrice && <span className="mr-2 text-base text-slate line-through">{props.originalPrice}</span>}
                  {props.price}
                </span>
              </div>
              <input className="input py-3 text-sm uppercase" placeholder={t("code")} value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} />
              <label className="flex items-start gap-3 text-xs leading-relaxed text-ivory/80">
                <input type="checkbox" className="mt-0.5 accent-[#d8c7a7]" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t("consent")}
              </label>
              <button className="btn-primary w-full" disabled={!consent || busy} onClick={buy}>
                <Lock className="h-4 w-4" /> {busy ? t("redirecting") : t("buy")}
              </button>
              <p className="text-center text-xs text-slate-2">{t("delivery")}</p>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-danger">{t("error")}</p>}
        </div>
      )}
    </div>
  );
}
