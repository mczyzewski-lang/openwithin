import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";

export async function storefront(slug: string) {
  const [pro] = await db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.slug, slug));
  if (!pro) return null;
  const [store] = await db.select().from(schema.professionalStores).where(eq(schema.professionalStores.professionalId, pro.id));
  const products = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.professionalId, pro.id), eq(schema.products.status, "published"), eq(schema.products.visibility, "public")));
  const variants = products.length ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, products.map((p) => p.id))) : [];
  return { pro, store, products, variants };
}

export async function productBySlugs(proSlug: string, productSlug: string) {
  const [pro] = await db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.slug, proSlug));
  if (!pro) return null;
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.professionalId, pro.id), eq(schema.products.slug, productSlug)));
  if (!product) return null;
  return { pro, product };
}
