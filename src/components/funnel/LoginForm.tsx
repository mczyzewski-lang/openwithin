"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";
import { Mail } from "lucide-react";

interface Props {
  next: string;
  mode: "supabase" | "demo" | "unconfigured";
  appleEnabled: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export function LoginForm({ next, mode, appleEnabled, supabaseUrl, supabaseAnonKey }: Props) {
  const t = useTranslations("login");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const supabase = mode === "supabase" && supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null;
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${marketing ? "&marketing=1" : ""}`;

  async function oauth(provider: "google" | "apple") {
    if (!supabase || !terms) return;
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback() } });
  }

  async function emailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) return;
    setState("sending");
    try {
      if (mode === "demo") {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, locale, marketing, terms: true }),
        });
        if (!res.ok) throw new Error();
        window.location.href = next;
        return;
      }
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } });
      if (error) throw error;
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (mode === "unconfigured") return <p className="rounded-2xl border border-ivory/10 p-4 text-sm text-slate">{t("unconfigured")}</p>;

  if (state === "sent") {
    return (
      <div className="card p-6 text-center">
        <Mail className="mx-auto h-6 w-6 text-champagne" />
        <p className="mt-4 text-ivory">{t("checkEmail")}</p>
        <p className="mt-2 text-sm text-slate">{email}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm text-ivory/80">
        <input type="checkbox" className="mt-1 accent-[#d8c7a7]" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
        <span>
          {t.rich("terms", {
            terms: (c) => <a href={`/${locale}/legal/terms`} className="underline decoration-champagne/50 underline-offset-4">{c}</a>,
            privacy: (c) => <a href={`/${locale}/legal/privacy`} className="underline decoration-champagne/50 underline-offset-4">{c}</a>,
          })}
        </span>
      </label>
      {mode === "supabase" && (
        <>
          <button type="button" className="btn-primary w-full" disabled={!terms} onClick={() => oauth("google")}>
            {t("google")}
          </button>
          {appleEnabled && (
            <button type="button" className="btn-ghost w-full" disabled={!terms} onClick={() => oauth("apple")}>
              {t("apple")}
            </button>
          )}
          <div className="flex items-center gap-3 py-1 text-xs text-slate-2">
            <span className="h-px flex-1 bg-ivory/10" /> {t("or")} <span className="h-px flex-1 bg-ivory/10" />
          </div>
        </>
      )}
      <form onSubmit={emailSignIn} className="space-y-3">
        <input type="email" required className="input" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <button type="submit" className={mode === "demo" ? "btn-primary w-full" : "btn-ghost w-full"} disabled={!terms || state === "sending"}>
          {mode === "demo" ? t("demoContinue") : t("email")}
        </button>
      </form>
      <label className="flex items-start gap-3 text-xs text-slate">
        <input type="checkbox" className="mt-0.5 accent-[#d8c7a7]" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>{t("marketing")}</span>
      </label>
      {state === "error" && <p className="text-sm text-danger">{t("error")}</p>}
      {mode === "demo" && <p className="rounded-2xl border border-champagne/20 p-3 text-xs leading-relaxed text-champagne/80">{t("demoNotice")}</p>}
    </div>
  );
}
