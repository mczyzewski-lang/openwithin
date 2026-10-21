import "server-only";
import Stripe from "stripe";
import { env } from "../env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, appInfo: { name: "OpenWithin" } });
  return client;
}

export function isTestMode(): boolean {
  return !!env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
}
