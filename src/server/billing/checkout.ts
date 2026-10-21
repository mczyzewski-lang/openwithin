import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { env, features } from "../env";
import { track } from "../analytics/events";
import { commissionRates, splitRevenue } from "./pricing";
import { stripe } from "./stripe";

export class CheckoutError extends Error {}

interface StartCheckoutInput {
  userId: string;
  email: string | null;
  locale: string;
  kind: "offer" | "product";
  offerId?: string;
  productId?: string;
  draftId?: string | null;
  currency: string;
  amountMinor: number;
  discountCodeId?: string | null;
  title: string;
  recurring?: "month" | "year" | null;
  successPath: string;
  cancelPath: string;
}

/**
 * Creates a checkout_sessions row first, then the provider session. Prices are passed as
 * price_data so they stay configurable from our admin panel without Stripe dashboard work.
 */
export async function startCheckout(input: StartCheckoutInput): Promise<{ url: string; checkoutId: string }> {
  const provider = features.stripe ? "stripe" : features.demoCheckout ? "demo" : null;
  if (!provider) throw new CheckoutError("payments_not_configured");

  const [row] = await db
    .insert(schema.checkoutSessions)
    .values({
      userId: input.userId,
      provider,
      kind: input.kind,
      offerId: input.offerId ?? null,
      productId: input.productId ?? null,
      draftId: input.draftId ?? null,
      currency: input.currency,
      amountMinor: input.amountMinor,
      discountCodeId: input.discountCodeId ?? null,
    })
    .returning();

  await track("checkout_started", { userId: input.userId, productId: input.productId, props: { kind: input.kind, offerId: input.offerId, amount: input.amountMinor, currency: input.currency } });

  if (provider === "demo") {
    await db.update(schema.checkoutSessions).set({ providerSessionId: `demo_${row.id}` }).where(eq(schema.checkoutSessions.id, row.id));
    return { url: `/${input.locale}/checkout/demo/${row.id}`, checkoutId: row.id };
  }

  const base = env.APP_URL.replace(/\/$/, "");
  const session = await stripe().checkout.sessions.create(
    {
      mode: input.recurring ? "subscription" : "payment",
      client_reference_id: row.id,
      customer_email: input.email ?? undefined,
      locale: (["pl", "es", "en"].includes(input.locale) ? input.locale : "auto") as "pl" | "es" | "en" | "auto",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amountMinor,
            product_data: { name: input.title },
            ...(input.recurring ? { recurring: { interval: input.recurring } } : {}),
          },
        },
      ],
      metadata: { checkout_id: row.id, kind: input.kind, offer_id: input.offerId ?? "", product_id: input.productId ?? "" },
      ...(input.recurring ? { subscription_data: { metadata: { checkout_id: row.id, offer_id: input.offerId ?? "" } } } : {}),
      success_url: `${base}${input.successPath}${input.successPath.includes("?") ? "&" : "?"}checkout=${row.id}`,
      cancel_url: `${base}${input.cancelPath}`,
    },
    { idempotencyKey: `checkout_${row.id}` },
  );
  await db.update(schema.checkoutSessions).set({ providerSessionId: session.id }).where(eq(schema.checkoutSessions.id, row.id));
  if (!session.url) throw new CheckoutError("no_checkout_url");
  return { url: session.url, checkoutId: row.id };
}

/**
 * Idempotent fulfilment: one purchase per checkout session (unique index), entitlements
 * created in the same transaction. Webhook retries never double-grant.
 */
export async function fulfillCheckout(input: {
  checkoutId: string;
  providerPaymentId?: string | null;
  amountTotalMinor?: number | null;
  taxMinor?: number | null;
  subscription?: { providerSubscriptionId: string; currentPeriodEnd: Date | null } | null;
}): Promise<{ purchaseId: string; alreadyFulfilled: boolean } | null> {
  const result = await db.transaction(async (tx) => {
    const [cs] = await tx.select().from(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, input.checkoutId)).for("update");
    if (!cs) return null;
    if (cs.status === "completed") {
      const [p] = await tx.select().from(schema.purchases).where(eq(schema.purchases.checkoutSessionId, cs.id));
      return p ? { purchaseId: p.id, alreadyFulfilled: true, cs } : null;
    }
    const gross = input.amountTotalMinor ?? cs.amountMinor;
    const tax = input.taxMinor ?? 0;

    let professionalId: string | null = null;
    let product: typeof schema.products.$inferSelect | undefined;
    if (cs.productId) {
      [product] = await tx.select().from(schema.products).where(eq(schema.products.id, cs.productId));
      professionalId = product?.professionalId ?? null;
    }

    const [purchase] = await tx
      .insert(schema.purchases)
      .values({
        userId: cs.userId,
        checkoutSessionId: cs.id,
        kind: cs.kind,
        offerId: cs.offerId,
        productId: cs.productId,
        professionalId,
        currency: cs.currency,
        amountGrossMinor: gross,
        taxMinor: tax,
        providerPaymentId: input.providerPaymentId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (!purchase) return null;

    if (cs.kind === "offer" && cs.offerId) {
      const [offer] = await tx.select().from(schema.offers).where(eq(schema.offers.id, cs.offerId));
      if (offer?.kind === "subscription") {
        const [sub] = await tx
          .insert(schema.subscriptions)
          .values({
            userId: cs.userId,
            offerId: offer.id,
            provider: cs.provider,
            providerSubscriptionId: input.subscription?.providerSubscriptionId ?? `demo_${cs.id}`,
            status: "active",
            currentPeriodEnd: input.subscription?.currentPeriodEnd ?? new Date(Date.now() + 31 * 86400_000),
          })
          .onConflictDoNothing()
          .returning();
        if (offer.audience === "professional") {
          await tx.update(schema.professionalProfiles).set({ plan: "pro" }).where(eq(schema.professionalProfiles.userId, cs.userId));
        } else if (sub) {
          await tx.insert(schema.entitlements).values({
            userId: cs.userId,
            source: "subscription",
            kind: "session_credits",
            subscriptionId: sub.id,
            purchaseId: purchase.id,
            creditsTotal: offer.credits,
            maxDurationMin: offer.maxDurationMin,
            validUntil: sub.currentPeriodEnd,
          });
        }
      } else if (offer) {
        await tx.insert(schema.entitlements).values({
          userId: cs.userId,
          source: "purchase",
          kind: "session_credits",
          purchaseId: purchase.id,
          creditsTotal: offer.credits,
          maxDurationMin: offer.maxDurationMin,
        });
      }
    }

    if (cs.kind === "product" && product) {
      await tx.insert(schema.entitlements).values({
        userId: cs.userId,
        source: "purchase",
        kind: "product_access",
        purchaseId: purchase.id,
        productId: product.id,
        creditsTotal: product.sessionsCount,
        maxDurationMin: product.durationMin,
      });
      // Commission ledger. Payouts are created separately and held until payouts are explicitly enabled.
      const [pro] = await tx.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.id, product.professionalId));
      const rates = await commissionRates();
      const rateBps = pro?.plan === "pro" ? rates.pro : rates.starter;
      const net = gross - tax;
      const split = splitRevenue(net, rateBps);
      await tx.insert(schema.platformCommissions).values({
        purchaseId: purchase.id,
        professionalId: product.professionalId,
        rateBps,
        netMinor: net,
        platformMinor: split.platform,
        authorMinor: split.author,
        currency: cs.currency,
      });
      if (cs.discountCodeId) {
        await tx
          .update(schema.discountCodes)
          .set({ redeemedCount: sql`${schema.discountCodes.redeemedCount} + 1` })
          .where(eq(schema.discountCodes.id, cs.discountCodeId));
      }
    }

    await tx.update(schema.checkoutSessions).set({ status: "completed", completedAt: new Date() }).where(eq(schema.checkoutSessions.id, cs.id));
    return { purchaseId: purchase.id, alreadyFulfilled: false, cs, professionalId };
  });
  if (!result) return null;
  if (!result.alreadyFulfilled) {
    await track("purchase_completed", {
      userId: result.cs.userId,
      productId: result.cs.productId ?? undefined,
      professionalId: (result as { professionalId?: string | null }).professionalId ?? undefined,
      props: { kind: result.cs.kind, offerId: result.cs.offerId, amount: result.cs.amountMinor, currency: result.cs.currency },
    });
  }
  return { purchaseId: result.purchaseId, alreadyFulfilled: result.alreadyFulfilled };
}

/** Refund handling: revoke access, mark purchase refunded, reverse unpaid commission. */
export async function handleRefund(providerPaymentId: string) {
  await db.transaction(async (tx) => {
    const [purchase] = await tx.select().from(schema.purchases).where(eq(schema.purchases.providerPaymentId, providerPaymentId));
    if (!purchase || purchase.status === "refunded") return;
    await tx.update(schema.purchases).set({ status: "refunded" }).where(eq(schema.purchases.id, purchase.id));
    await tx.update(schema.entitlements).set({ revokedAt: new Date() }).where(eq(schema.entitlements.purchaseId, purchase.id));
    await tx
      .update(schema.platformCommissions)
      .set({ status: "reversed" })
      .where(and(eq(schema.platformCommissions.purchaseId, purchase.id), eq(schema.platformCommissions.status, "accrued")));
  });
}
