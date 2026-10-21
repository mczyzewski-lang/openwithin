import "server-only";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getTechnique } from "@/content/techniques/registry";
import { experienceSettingsSchema } from "@/lib/settings";
import { db, schema } from "../db";
import { requestFullExperience } from "../experiences";
import { startProgram } from "../programs";
import { buildContext } from "../scenario/context";
import { templatePreviewLines, type BaseSegment } from "./templates";

type Product = typeof schema.products.$inferSelect;

export async function getProductWithTemplate(productId: string) {
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!product) return null;
  const [template] = product.templateId ? await db.select().from(schema.experienceTemplates).where(eq(schema.experienceTemplates.id, product.templateId)) : [];
  return { product, template: template ?? null };
}

/** The 15-second preview of a product is the real opening of the author's script, personalised. */
export async function productPreviewLines(productId: string, rawSettings: unknown): Promise<string[] | undefined> {
  const data = await getProductWithTemplate(productId);
  if (!data || data.product.status !== "published" || !data.template?.baseSegments) return undefined;
  const parsed = experienceSettingsSchema.safeParse(rawSettings);
  if (!parsed.success) return undefined;
  const ctx = buildContext({ ...parsed.data, techniqueId: data.product.techniqueId as never, recordingLanguage: data.product.language as never });
  const lines = templatePreviewLines(data.template.baseSegments as BaseSegment[], ctx);
  return lines.length ? lines : undefined;
}

export async function productPrices(productId: string) {
  return db.select().from(schema.productVariants).where(and(eq(schema.productVariants.productId, productId), eq(schema.productVariants.active, true)));
}

/** Resolve a product's price in the buyer's currency (falls back to the author's first currency) and apply a discount code. */
export async function priceProduct(product: Product, currency: string, code?: string) {
  const variants = await productPrices(product.id);
  const variant = variants.find((v) => v.currency === currency) ?? variants[0];
  if (!variant) return null;
  let amount = variant.amountMinor;
  let discountCodeId: string | null = null;
  if (code) {
    const [dc] = await db
      .select()
      .from(schema.discountCodes)
      .where(
        and(
          eq(sql`upper(${schema.discountCodes.code})`, code.trim().toUpperCase()),
          eq(schema.discountCodes.professionalId, product.professionalId),
          eq(schema.discountCodes.active, true),
          or(isNull(schema.discountCodes.productId), eq(schema.discountCodes.productId, product.id)),
          or(isNull(schema.discountCodes.expiresAt), gt(schema.discountCodes.expiresAt, new Date())),
          or(isNull(schema.discountCodes.maxRedemptions), sql`${schema.discountCodes.redeemedCount} < ${schema.discountCodes.maxRedemptions}`),
        ),
      );
    if (dc?.percentOff) {
      amount = Math.max(0, Math.round((amount * (100 - dc.percentOff)) / 100));
      discountCodeId = dc.id;
    }
  }
  return { currency: variant.currency, amountMinor: amount, discountCodeId, originalMinor: variant.amountMinor };
}

/**
 * After payment: deliver the personalised experience automatically from the settings the
 * buyer chose before checkout (no need to fill the form again).
 */
export async function afterPurchase(checkoutId: string) {
  const [cs] = await db.select().from(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, checkoutId));
  if (!cs?.draftId) return;
  try {
    if (cs.kind === "product") {
      const [product] = cs.productId ? await db.select().from(schema.products).where(eq(schema.products.id, cs.productId)) : [];
      if (product?.programId) {
        // Programme products start at day 1; later days are generated when the buyer is ready.
        await startProgram(cs.userId, product.programId, product.id);
        await db.update(schema.experienceDrafts).set({ programId: product.programId, programDay: 1 }).where(eq(schema.experienceDrafts.id, cs.draftId));
      }
      await requestFullExperience({ userId: cs.userId, draftId: cs.draftId });
    } else if (cs.offerId === "extend_30") {
      const [draft] = await db.select().from(schema.experienceDrafts).where(eq(schema.experienceDrafts.id, cs.draftId));
      const technique = draft ? getTechnique(draft.techniqueId) : undefined;
      // "Extend to 30 minutes": the same settings, rendered at 30 min (or the technique's longest length).
      const minutes = Math.min(30, Math.max(...(technique?.durations ?? [30])));
      await requestFullExperience({ userId: cs.userId, draftId: cs.draftId, durationMin: minutes });
    }
  } catch (e) {
    console.error("[afterPurchase] delivery could not be queued", e);
  }
}

/** Free products and private shares grant access without a payment. */
export async function grantFreeAccess(userId: string, product: Product, source: "purchase" | "share", shareLinkId?: string) {
  const [existing] = await db
    .select()
    .from(schema.entitlements)
    .where(and(eq(schema.entitlements.userId, userId), eq(schema.entitlements.productId, product.id), isNull(schema.entitlements.revokedAt)));
  if (existing) return existing;
  const [ent] = await db
    .insert(schema.entitlements)
    .values({
      userId,
      source,
      kind: "product_access",
      productId: product.id,
      shareLinkId: shareLinkId ?? null,
      creditsTotal: product.sessionsCount,
      maxDurationMin: product.durationMin,
    })
    .returning();
  return ent;
}
