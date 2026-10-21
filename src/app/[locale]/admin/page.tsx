import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { platformMetrics } from "@/server/analytics/metrics";
import { commissionRates } from "@/server/billing/pricing";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { requireAdmin } from "@/server/guards";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Operator panel (English only): prices, commission, moderation, real retention metrics. */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const [m, prices, offers, rates, pending, flags] = await Promise.all([
    platformMetrics(),
    db.select().from(schema.offerPrices).orderBy(asc(schema.offerPrices.offerId), asc(schema.offerPrices.market)),
    db.select().from(schema.offers).orderBy(asc(schema.offers.sort)),
    commissionRates(),
    db.select().from(schema.products).where(eq(schema.products.status, "pending_review")),
    db.select().from(schema.moderationFlags).where(eq(schema.moderationFlags.status, "open")).orderBy(desc(schema.moderationFlags.createdAt)).limit(50),
  ]);

  async function savePrice(fd: FormData) {
    "use server";
    await requireAdmin(locale);
    const amount = Math.round(Number(fd.get("amount")) * 100);
    if (!Number.isFinite(amount) || amount < 0) return;
    await db
      .update(schema.offerPrices)
      .set({ amountMinor: amount })
      .where(and(eq(schema.offerPrices.offerId, String(fd.get("offerId"))), eq(schema.offerPrices.market, String(fd.get("market")))));
    revalidatePath(`/${locale}/admin`);
  }

  async function saveOffer(fd: FormData) {
    "use server";
    await requireAdmin(locale);
    await db
      .update(schema.offers)
      .set({ credits: Number(fd.get("credits")), maxDurationMin: Number(fd.get("maxDurationMin")), active: fd.get("active") === "on" })
      .where(eq(schema.offers.id, String(fd.get("id"))));
    revalidatePath(`/${locale}/admin`);
  }

  async function saveCommission(fd: FormData) {
    "use server";
    await requireAdmin(locale);
    const value = { starter: Math.round(Number(fd.get("starter")) * 100), pro: Math.round(Number(fd.get("pro")) * 100) };
    await db.insert(schema.platformSettings).values({ key: "commission_bps", value }).onConflictDoUpdate({ target: schema.platformSettings.key, set: { value, updatedAt: new Date() } });
    revalidatePath(`/${locale}/admin`);
  }

  async function review(fd: FormData) {
    "use server";
    await requireAdmin(locale);
    const approve = fd.get("decision") === "approve";
    await db
      .update(schema.products)
      .set({ status: approve ? "published" : "rejected", publishedAt: approve ? new Date() : null, reviewNotes: String(fd.get("notes") ?? "") || null })
      .where(eq(schema.products.id, String(fd.get("id"))));
    await db.update(schema.moderationFlags).set({ status: "resolved" }).where(eq(schema.moderationFlags.entityId, String(fd.get("id"))));
    revalidatePath(`/${locale}/admin`);
  }

  async function dismiss(fd: FormData) {
    "use server";
    await requireAdmin(locale);
    await db.update(schema.moderationFlags).set({ status: "dismissed" }).where(eq(schema.moderationFlags.id, String(fd.get("id"))));
    revalidatePath(`/${locale}/admin`);
  }

  const Card = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="card p-5">
      <p className="text-xs text-slate">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ivory">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-2">{hint}</p>}
    </div>
  );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl space-y-12 px-5 pb-20 pt-10">
        <h1 className="text-3xl text-ivory">Admin</h1>
        <section>
          <h2 className="eyebrow">Retention (real listening behaviour)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Card label="D1 return" value={pct(m.retention.d1)} hint={`cohort ${m.retention.cohorts.d1}`} />
            <Card label="D7 return" value={pct(m.retention.d7)} hint={`cohort ${m.retention.cohorts.d7}`} />
            <Card label="D30 return" value={pct(m.retention.d30)} hint={`cohort ${m.retention.cohorts.d30}`} />
            <Card label="Replay share of listens" value={pct(m.replayRate)} />
            <Card label="Completion rate" value={pct(m.completionRate)} />
            <Card label="Programme continuation" value={pct(m.programContinuation)} hint="≥2 days completed" />
            <Card label="Repeat purchase rate" value={pct(m.repeatPurchaseRate)} />
            <Card label="Regenerated sessions (30d)" value={String(m.funnel.regenerations)} />
            <Card label="Active creators (30d)" value={`${m.creators.active}/${m.creators.total}`} />
            <Card label="Returning buyers per creator" value={String(m.creators.returning_buyers)} />
          </div>
        </section>
        <section>
          <h2 className="eyebrow">Funnel (30 days)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Card label="Previews" value={String(m.funnel.previews)} />
            <Card label="Sign-ups" value={String(m.funnel.signups)} />
            <Card label="Full sessions" value={String(m.funnel.full_sessions)} />
            <Card label="Purchases" value={String(m.funnel.purchases)} />
          </div>
        </section>
        <section>
          <h2 className="eyebrow">Cost control (24h)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Card label="TTS characters" value={m.cost.chars.toLocaleString()} hint={`budget ${env.TTS_DAILY_CHAR_BUDGET.toLocaleString()}`} />
            <Card label="Served from cache" value={m.cost.cached.toLocaleString()} />
            <Card label="Estimated spend" value={`$${m.cost.usd.toFixed(2)}`} />
          </div>
        </section>
        <section>
          <h2 className="eyebrow">Offers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {offers.map((o) => (
              <form key={o.id} action={saveOffer} className="card flex flex-wrap items-end gap-3 p-4 text-sm">
                <input type="hidden" name="id" value={o.id} />
                <p className="w-full text-ivory">{o.id} <span className="text-slate">· {o.kind}</span></p>
                <label className="text-xs text-slate">credits<input name="credits" type="number" defaultValue={o.credits} className="input mt-1 w-24 py-2" /></label>
                <label className="text-xs text-slate">max min<input name="maxDurationMin" type="number" defaultValue={o.maxDurationMin} className="input mt-1 w-24 py-2" /></label>
                <label className="flex items-center gap-2 text-xs text-slate"><input type="checkbox" name="active" defaultChecked={o.active} /> active</label>
                <button className="btn-ghost px-4 py-2 text-xs">Save</button>
              </form>
            ))}
          </div>
          <h3 className="mt-8 text-sm text-slate">Prices per market</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {prices.map((p) => (
              <form key={`${p.offerId}-${p.market}`} action={savePrice} className="card flex items-end gap-2 p-3 text-xs">
                <input type="hidden" name="offerId" value={p.offerId} />
                <input type="hidden" name="market" value={p.market} />
                <label className="flex-1 text-slate">{p.offerId} · {p.market} ({p.currency.toUpperCase()})
                  <input name="amount" type="number" step="0.01" defaultValue={(p.amountMinor / 100).toFixed(2)} className="input mt-1 py-2" />
                </label>
                <button className="btn-ghost px-3 py-2 text-xs">Save</button>
              </form>
            ))}
          </div>
        </section>
        <section>
          <h2 className="eyebrow">Marketplace commission</h2>
          <form action={saveCommission} className="card mt-4 flex flex-wrap items-end gap-4 p-5 text-sm">
            <label className="text-xs text-slate">Starter Studio (% of net)<input name="starter" type="number" step="0.5" defaultValue={rates.starter / 100} className="input mt-1 w-28 py-2" /></label>
            <label className="text-xs text-slate">Studio Pro (% of net)<input name="pro" type="number" step="0.5" defaultValue={rates.pro / 100} className="input mt-1 w-28 py-2" /></label>
            <button className="btn-ghost px-4 py-2 text-xs">Save</button>
            <p className="w-full text-xs text-slate-2">Payouts: {env.MARKETPLACE_PAYOUTS_ENABLED ? "ENABLED" : "disabled (MARKETPLACE_PAYOUTS_ENABLED=false) — payouts are recorded as held"}</p>
          </form>
        </section>
        <section>
          <h2 className="eyebrow">Moderation — products pending review</h2>
          <div className="mt-4 space-y-3">
            {pending.map((p) => (
              <form key={p.id} action={review} className="card space-y-3 p-5 text-sm">
                <input type="hidden" name="id" value={p.id} />
                <p className="text-ivory">{p.title}</p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate">{p.reviewNotes}</pre>
                <input name="notes" className="input py-2 text-sm" placeholder="Notes to author" />
                <div className="flex gap-2">
                  <button name="decision" value="approve" className="btn-ghost px-4 py-2 text-xs">Approve</button>
                  <button name="decision" value="reject" className="btn-ghost px-4 py-2 text-xs">Reject</button>
                </div>
              </form>
            ))}
            {!pending.length && <p className="text-sm text-slate">Nothing waiting.</p>}
          </div>
          <h3 className="mt-8 text-sm text-slate">Open flags</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {flags.map((f) => (
              <li key={f.id} className="card flex items-center justify-between gap-3 p-3">
                <span className="text-slate">{f.createdAt.toISOString().slice(0, 16)} · {f.entityType} · {f.reason}</span>
                <form action={dismiss}><input type="hidden" name="id" value={f.id} /><button className="text-champagne">dismiss</button></form>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
