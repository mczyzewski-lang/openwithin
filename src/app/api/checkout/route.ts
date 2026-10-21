import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { CheckoutError, startCheckout } from "@/server/billing/checkout";
import { currencyForMarket, marketForLocale, offersForMarket } from "@/server/billing/pricing";
import { db, schema } from "@/server/db";
import { priceProduct } from "@/server/studio/products";
import { techniqueName } from "@/content/techniques";

export const dynamic = "force-dynamic";

const body = z.object({
  offerId: z.string().max(40).optional(),
  productId: z.string().uuid().optional(),
  draftId: z.string().uuid().optional().nullable(),
  discountCode: z.string().max(40).optional(),
  locale: z.string().max(5).default("en"),
  returnPath: z.string().max(300).startsWith("/").optional(),
  // EU digital content: explicit consent to immediate delivery & acknowledgement of losing withdrawal right
  digitalContentConsent: z.literal(true),
});

const OFFER_TITLES: Record<string, string> = {
  extend_30: "OpenWithin · 30-minute personal session",
  pack_5: "OpenWithin · 5 personal sessions",
  personal_plan: "OpenWithin · Personal Plan",
  studio_pro: "OpenWithin Studio Pro",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { offerId, productId, draftId, locale } = parsed.data;
  const market = marketForLocale(locale, req.cookies.get("ow_market")?.value);
  const returnPath = parsed.data.returnPath ?? `/${locale}/space`;

  await db.insert(schema.consents).values({ userId: user.id, kind: "digital_content", version: "2026-10", granted: true });

  try {
    if (offerId) {
      const audience = offerId === "studio_pro" ? "professional" : "consumer";
      const offer = (await offersForMarket(market, audience)).find((o) => o.id === offerId);
      if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const { url } = await startCheckout({
        userId: user.id,
        email: user.email,
        locale,
        kind: "offer",
        offerId,
        draftId,
        currency: offer.currency,
        amountMinor: offer.amountMinor,
        title: OFFER_TITLES[offerId] ?? offerId,
        recurring: offer.kind === "subscription" ? ((offer.interval as "month") ?? "month") : null,
        successPath: returnPath,
        cancelPath: returnPath,
      });
      return NextResponse.json({ url });
    }
    if (productId) {
      const [product] = await db.select().from(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.status, "published")));
      if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const priced = await priceProduct(product, currencyForMarket(market), parsed.data.discountCode);
      if (!priced) return NextResponse.json({ error: "not_available_in_currency" }, { status: 400 });
      const { url } = await startCheckout({
        userId: user.id,
        email: user.email,
        locale,
        kind: "product",
        productId,
        draftId,
        currency: priced.currency,
        amountMinor: priced.amountMinor,
        discountCodeId: priced.discountCodeId,
        title: `${product.title} · ${techniqueName(locale, product.techniqueId)}`,
        successPath: returnPath,
        cancelPath: returnPath,
      });
      return NextResponse.json({ url });
    }
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[api/checkout]", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
