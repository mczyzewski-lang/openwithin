import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { fulfillCheckout } from "@/server/billing/checkout";
import { db, schema } from "@/server/db";
import { features } from "@/server/env";
import { afterPurchase } from "@/server/studio/products";

export const dynamic = "force-dynamic";

/** DEMO MODE ONLY: simulates a successful payment for local development without Stripe keys. */
export async function POST(req: NextRequest) {
  if (!features.demoCheckout) return NextResponse.json({ error: "not_available" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ checkoutId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const [cs] = await db
    .select()
    .from(schema.checkoutSessions)
    .where(and(eq(schema.checkoutSessions.id, parsed.data.checkoutId), eq(schema.checkoutSessions.userId, user.id), eq(schema.checkoutSessions.provider, "demo")));
  if (!cs) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const result = await fulfillCheckout({ checkoutId: cs.id, providerPaymentId: `demo_pi_${cs.id}` });
  if (result && !result.alreadyFulfilled) await afterPurchase(cs.id);
  return NextResponse.json({ ok: true, ...result });
}
