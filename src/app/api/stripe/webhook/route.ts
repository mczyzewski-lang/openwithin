import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { fulfillCheckout, handleRefund } from "@/server/billing/checkout";
import { stripe } from "@/server/billing/stripe";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { afterPurchase } from "@/server/studio/products";

export const dynamic = "force-dynamic";

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as Obj).id) : null);

/**
 * Stripe webhooks. Signature-verified; every handler is idempotent (unique checkout →
 * purchase mapping), so Stripe retries can never double-grant access or double-record a charge.
 */
export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  let event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  const object = event.data.object as unknown as Obj;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (object.payment_status !== "paid" && object.payment_status !== "no_payment_required") break;
      const checkoutId = (object.client_reference_id as string) ?? ((object.metadata as Obj)?.checkout_id as string);
      if (!checkoutId) break;
      let subscription: { providerSubscriptionId: string; currentPeriodEnd: Date | null } | null = null;
      const subId = str(object.subscription);
      if (subId) {
        const sub = (await stripe().subscriptions.retrieve(subId)) as unknown as Obj;
        const item = ((sub.items as Obj)?.data as Obj[])?.[0];
        const end = (item?.current_period_end as number) ?? (sub.current_period_end as number);
        subscription = { providerSubscriptionId: subId, currentPeriodEnd: end ? new Date(end * 1000) : null };
      }
      const totals = object.total_details as Obj | undefined;
      const result = await fulfillCheckout({
        checkoutId,
        providerPaymentId: str(object.payment_intent) ?? str(object.invoice),
        amountTotalMinor: (object.amount_total as number) ?? null,
        taxMinor: (totals?.amount_tax as number) ?? 0,
        subscription,
      });
      if (result && !result.alreadyFulfilled) await afterPurchase(checkoutId);
      break;
    }
    case "invoice.paid": {
      // Renewal: new monthly credits for Personal Plan subscribers.
      if (object.billing_reason !== "subscription_cycle") break;
      const parent = object.parent as Obj | undefined;
      const subId = str((parent?.subscription_details as Obj)?.subscription) ?? str(object.subscription);
      if (!subId) break;
      const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.providerSubscriptionId, subId));
      if (!sub) break;
      const [offer] = await db.select().from(schema.offers).where(eq(schema.offers.id, sub.offerId));
      const lines = ((object.lines as Obj)?.data as Obj[]) ?? [];
      const periodEnd = (lines[0]?.period as Obj)?.end as number | undefined;
      const validUntil = periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 31 * 86400_000);
      await db.update(schema.subscriptions).set({ status: "active", currentPeriodEnd: validUntil, updatedAt: new Date() }).where(eq(schema.subscriptions.id, sub.id));
      if (offer && offer.audience === "consumer" && offer.credits > 0) {
        await db.insert(schema.entitlements).values({ userId: sub.userId, source: "subscription", kind: "session_credits", subscriptionId: sub.id, creditsTotal: offer.credits, maxDurationMin: offer.maxDurationMin, validUntil });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subId = str(object.id);
      if (!subId) break;
      const status = event.type === "customer.subscription.deleted" ? "canceled" : String(object.status);
      const [sub] = await db
        .update(schema.subscriptions)
        .set({ status, cancelAtPeriodEnd: Boolean(object.cancel_at_period_end), updatedAt: new Date() })
        .where(eq(schema.subscriptions.providerSubscriptionId, subId))
        .returning();
      if (sub && status === "canceled" && sub.offerId === "studio_pro") {
        await db.update(schema.professionalProfiles).set({ plan: "starter" }).where(eq(schema.professionalProfiles.userId, sub.userId));
      }
      break;
    }
    case "charge.refunded": {
      const pi = str(object.payment_intent);
      if (pi) await handleRefund(pi);
      break;
    }
    case "account.updated": {
      const accountId = str(object.id);
      if (!accountId) break;
      await db
        .update(schema.professionalStores)
        .set({
          chargesEnabled: Boolean(object.charges_enabled),
          payoutsEnabled: Boolean(object.payouts_enabled),
          stripeOnboardingStatus: object.details_submitted ? "complete" : "pending",
        })
        .where(eq(schema.professionalStores.stripeAccountId, accountId));
      break;
    }
  }
  return NextResponse.json({ received: true });
}
