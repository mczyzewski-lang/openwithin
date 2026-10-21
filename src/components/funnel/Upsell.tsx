"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Clock, Layers, Map, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

interface Offer {
  id: string;
  kind: string;
  credits: number;
  maxDurationMin: number;
  interval: string | null;
  currency: string;
  amountMinor: number;
}

interface Props {
  offers: Offer[];
  draftId: string | null;
  currentMinutes: number;
  credits: { total: number; maxDurationMin: number };
  isProduct: boolean;
  returnPath: string;
}

/** Contextual offers after the free experience. Prices come from the database (admin-configurable). */
export function Upsell({ offers, draftId, currentMinutes, credits, isProduct, returnPath }: Props) {
  const t = useTranslations("upsell");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isProduct) return null;
  const byId = Object.fromEntries(offers.map((o) => [o.id, o]));
  const canExtendWithCredits = draftId && credits.total > 0 && credits.maxDurationMin >= 20 && currentMinutes < credits.maxDurationMin;

  async function buy(offerId: string) {
    setPending(offerId);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, draftId, locale, returnPath, digitalContentConsent: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.location.href = `/${locale}/login?next=${encodeURIComponent(returnPath)}`;
      return;
    }
    if (!res.ok || !data.url) {
      setError(data.error ?? "generic");
      setPending(null);
      return;
    }
    window.location.href = data.url;
  }

  const cards = [
    byId.extend_30 && currentMinutes < 30 && draftId
      ? { id: "extend_30", icon: Clock, title: t("extendTitle"), body: t("extendBody"), price: formatMoney(byId.extend_30.amountMinor, byId.extend_30.currency, locale) }
      : null,
    byId.pack_5 ? { id: "pack_5", icon: Layers, title: t("packTitle"), body: t("packBody"), price: formatMoney(byId.pack_5.amountMinor, byId.pack_5.currency, locale) } : null,
    { id: "program", icon: Map, title: t("programTitle"), body: t("programBody"), price: null },
    byId.personal_plan
      ? { id: "personal_plan", icon: Sparkles, title: t("planTitle"), body: t("planBody", { credits: byId.personal_plan.credits }), price: `${formatMoney(byId.personal_plan.amountMinor, byId.personal_plan.currency, locale)} ${t("perMonth")}` }
      : null,
  ].filter(Boolean) as { id: string; icon: typeof Clock; title: string; body: string; price: string | null }[];

  return (
    <div id="offers">
      <h2 className="text-center text-2xl text-ivory sm:text-3xl">{t("title")}</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-slate">{t("subtitle")}</p>
      {canExtendWithCredits && (
        <div className="mx-auto mt-8 max-w-md text-center">
          <button className="btn-primary" onClick={() => router.push(`/continue/${draftId}?minutes=${Math.min(30, credits.maxDurationMin)}`)}>
            {t("useCredit", { minutes: Math.min(30, credits.maxDurationMin) })}
          </button>
          <p className="mt-2 text-xs text-slate-2">{t("creditsLeft", { count: credits.total })}</p>
        </div>
      )}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.id} className="card flex flex-col p-6">
            <c.icon className="h-5 w-5 text-champagne" strokeWidth={1.5} />
            <p className="mt-4 text-lg text-ivory">{c.title}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate">{c.body}</p>
            <div className="mt-6 flex items-center justify-between gap-3">
              {c.price ? <span className="text-ivory">{c.price}</span> : <span />}
              {c.id === "program" ? (
                <Link href="/explore#programs" className="btn-ghost px-4 py-2.5 text-sm">
                  {t("browse")} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button className="btn-ghost px-4 py-2.5 text-sm" disabled={!!pending} onClick={() => setConsentFor(c.id)}>
                  {pending === c.id ? t("redirecting") : t("choose")}
                </button>
              )}
            </div>
            {consentFor === c.id && (
              <div className="mt-5 rounded-2xl border border-ivory/10 p-4">
                <label className="flex items-start gap-3 text-xs leading-relaxed text-ivory/80">
                  <input type="checkbox" className="mt-0.5 accent-[#d8c7a7]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  {t("digitalConsent")}
                </label>
                <button className="btn-primary mt-4 w-full py-3 text-sm" disabled={!consent || !!pending} onClick={() => void buy(c.id)}>
                  {t("continueToPayment")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-6 text-center text-sm text-danger">{t(`error_${error === "payments_not_configured" ? "payments" : "generic"}`)}</p>}
    </div>
  );
}
