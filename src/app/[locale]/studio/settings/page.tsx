import { desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import { db, schema } from "@/server/db";
import { env, features } from "@/server/env";
import { requireProfessional } from "@/server/guards";
import { payoutSummary } from "@/server/studio/service";
import { commissionRates } from "@/server/billing/pricing";
import { connectAction, payoutAction, saveProfileAction, subscribeProAction, voiceCloneAction } from "../actions";

export default async function StudioSettings({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const { pro } = await requireProfessional(locale, `/${locale}/studio/settings`);
  const t = await getTranslations("studio.settings");
  const [[store], payouts, summary, rates, voiceRequests] = await Promise.all([
    db.select().from(schema.professionalStores).where(eq(schema.professionalStores.professionalId, pro.id)),
    db.select().from(schema.payouts).where(eq(schema.payouts.professionalId, pro.id)).orderBy(desc(schema.payouts.createdAt)),
    payoutSummary(pro.id),
    commissionRates(),
    db.select().from(schema.voiceCloneRequests).where(eq(schema.voiceCloneRequests.professionalId, pro.id)),
  ]);
  const accrued = summary.filter((s) => s.status === "accrued");
  const rate = pro.plan === "pro" ? rates.pro : rates.starter;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl">{t("title")}</h1>
      {sp.saved && <p className="rounded-2xl border border-night/15 bg-white p-3 text-sm">{t("saved")}</p>}
      {sp.error && <p className="rounded-2xl bg-danger/15 p-3 text-sm">{t(`err_${["payments_not_configured", "nothing_to_pay", "consent"].includes(sp.error) ? sp.error : "generic"}`)}</p>}
      {sp.payout && <p className="rounded-2xl border border-night/15 bg-white p-3 text-sm">{t("payoutRecorded")}</p>}

      <form action={saveProfileAction.bind(null, locale)} className="card space-y-4 p-6">
        <h2 className="text-lg">{t("profile")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">{t("displayName")}</label><input name="displayName" className="input" defaultValue={pro.displayName} /></div>
          <div><label className="label">{t("headline")}</label><input name="headline" className="input" defaultValue={pro.headline ?? ""} /></div>
        </div>
        <div><label className="label">{t("bio")}</label><textarea name="bio" className="input min-h-28" defaultValue={pro.bio ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">{t("credentials")}</label><input name="credentials" className="input" defaultValue={pro.credentials ?? ""} /></div>
          <div><label className="label">{t("website")}</label><input name="website" className="input" defaultValue={pro.website ?? ""} /></div>
          <div><label className="label">{t("brandColor")}</label><input name="brandColor" type="color" className="h-12 w-24 rounded-xl border border-night/15" defaultValue={pro.brandColor ?? "#101823"} /></div>
        </div>
        <label className="flex items-start gap-3 text-sm text-night/80">
          <input type="checkbox" name="clinicalMode" defaultChecked={pro.clinicalMode} className="mt-1" /> {t("clinicalMode")}
        </label>
        <button className="btn-primary px-5 py-2.5 text-sm">{t("save")}</button>
      </form>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg">{t("subscription")}</h2>
        <p className="text-sm text-night/70">{t("planLine", { plan: pro.plan === "pro" ? "Studio Pro" : "Starter Studio", rate: (rate / 100).toFixed(0) })}</p>
        {pro.plan !== "pro" && (
          <form action={subscribeProAction.bind(null, locale)}>
            <button className="btn-ghost px-5 py-2.5 text-sm">{t("upgrade", { rate: (rates.pro / 100).toFixed(0) })}</button>
          </form>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg">{t("payouts")}</h2>
        <p className="text-sm text-night/70">{t("connectStatus")}: {store?.stripeOnboardingStatus ?? "not_started"} {store?.payoutsEnabled ? `· ${t("payoutsReady")}` : ""}</p>
        {!env.MARKETPLACE_PAYOUTS_ENABLED && <p className="rounded-2xl border border-night/10 p-3 text-xs leading-relaxed text-night/60">{t("payoutsDisabled")}</p>}
        <form action={connectAction.bind(null, locale)}>
          <button className="btn-ghost px-5 py-2.5 text-sm" disabled={!features.stripe}>{t("connect")}</button>
        </form>
        <div className="text-sm">
          <p className="text-night/60">{t("accrued")}</p>
          <p className="mt-1">{accrued.length ? accrued.map((a) => formatMoney(a.author, a.currency, locale)).join(" · ") : "—"}</p>
        </div>
        {accrued.map((a) => (
          <form key={a.currency} action={payoutAction.bind(null, locale)}>
            <input type="hidden" name="currency" value={a.currency} />
            <button className="btn-ghost px-5 py-2.5 text-sm">{t("requestPayout", { amount: formatMoney(a.author, a.currency, locale) })}</button>
          </form>
        ))}
        <ul className="space-y-1 text-xs text-night/60">
          {payouts.map((p) => (
            <li key={p.id}>{p.createdAt.toISOString().slice(0, 10)} · {formatMoney(p.amountMinor, p.currency, locale)} · {p.status}{p.holdReason ? ` (${p.holdReason})` : ""}</li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg">{t("voice")}</h2>
        <p className="text-sm leading-relaxed text-night/70">{t("voiceBody")}</p>
        {voiceRequests.length ? (
          <p className="text-sm">{t("voiceStatus")}: {voiceRequests[0].status}</p>
        ) : (
          <form action={voiceCloneAction.bind(null, locale)} className="space-y-3">
            <label className="flex items-start gap-3 text-sm text-night/80"><input type="checkbox" name="identity" className="mt-1" /> {t("voiceIdentity")}</label>
            <label className="flex items-start gap-3 text-sm text-night/80"><input type="checkbox" name="consent" className="mt-1" /> {t("voiceConsent")}</label>
            <button className="btn-ghost px-5 py-2.5 text-sm">{t("voiceRequest")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
