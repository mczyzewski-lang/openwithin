"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfessional } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { absoluteUrl } from "@/lib/url";
import {
  composeTemplate,
  createProduct,
  createProfessional,
  createShareLink,
  onboardingSchema,
  productInputSchema,
  publishProduct,
  requestPayout,
  requestStudioSample,
  saveTemplateSegments,
  startConnectOnboarding,
  StudioError,
  templateInputSchema,
} from "@/server/studio/service";
import { startCheckout } from "@/server/billing/checkout";
import { currencyForMarket, marketForLocale, offersForMarket } from "@/server/billing/pricing";

async function pro() {
  const user = await getCurrentUser();
  if (!user) throw new StudioError("unauthorized");
  const p = await getProfessional(user.id);
  if (!p) throw new StudioError("not_professional");
  return { user, pro: p };
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export async function onboardAction(locale: string, _prev: unknown, fd: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/studio/onboarding`);
  const parsed = onboardingSchema.safeParse({
    displayName: str(fd, "displayName"),
    slug: str(fd, "slug") ?? str(fd, "displayName"),
    profession: str(fd, "profession"),
    headline: str(fd, "headline"),
    bio: str(fd, "bio"),
    credentials: str(fd, "credentials"),
    website: str(fd, "website") ?? "",
    acceptTerms: fd.get("acceptTerms") === "on" ? true : undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  try {
    await createProfessional(user.id, parsed.data);
  } catch (e) {
    return { error: e instanceof StudioError ? e.message : "generic" };
  }
  redirect(`/${locale}/studio`);
}

export async function composeAction(locale: string, _prev: unknown, fd: FormData) {
  const { pro: p } = await pro();
  const parsed = templateInputSchema.safeParse({
    title: str(fd, "title"),
    techniqueId: str(fd, "techniqueId"),
    language: str(fd, "language"),
    durationMin: str(fd, "durationMin"),
    voicePresetId: str(fd, "voicePresetId"),
    ambient: str(fd, "ambient"),
    ambientVolume: str(fd, "ambientVolume"),
    pauseLevel: str(fd, "pauseLevel"),
    style: str(fd, "style"),
    narratorInstructions: str(fd, "narratorInstructions"),
  });
  if (!parsed.success) return { error: "invalid" };
  const template = await composeTemplate(p.id, parsed.data);
  redirect(`/${locale}/studio/templates/${template.id}`);
}

export async function saveSegmentsAction(templateId: string, segments: unknown) {
  const { pro: p } = await pro();
  const result = await saveTemplateSegments(p.id, templateId, segments);
  revalidatePath(`/[locale]/studio/templates/${templateId}`, "page");
  return result;
}

export async function sampleAction(templateId: string, sampleName: string) {
  const { pro: p } = await pro();
  try {
    const job = await requestStudioSample(p, templateId, sampleName.slice(0, 40) || p.displayName.split(" ")[0]);
    return { jobId: job.id };
  } catch (e) {
    return { error: e instanceof StudioError ? e.message : "generic" };
  }
}

export async function createProductAction(locale: string, _prev: unknown, fd: FormData) {
  const { pro: p } = await pro();
  const parsed = productInputSchema.safeParse({
    title: str(fd, "title"),
    slug: str(fd, "slug"),
    description: str(fd, "description"),
    type: str(fd, "type"),
    templateIds: fd.getAll("templateIds").map(String).filter(Boolean),
    isFree: fd.get("isFree") === "on",
    visibility: str(fd, "visibility"),
    personalizationFields: fd.getAll("personalizationFields").map(String),
    prices: { pln: str(fd, "price_pln"), eur: str(fd, "price_eur"), usd: str(fd, "price_usd") },
  });
  if (!parsed.success) return { error: "invalid", issues: parsed.error.issues.map((i) => i.path.join(".")) };
  try {
    const product = await createProduct(p, parsed.data);
    redirect(`/${locale}/studio/products/${product.id}`);
  } catch (e) {
    if (e instanceof StudioError) return { error: e.message };
    throw e;
  }
}

export async function publishAction(locale: string, productId: string, fd: FormData) {
  const { pro: p } = await pro();
  if (fd.get("ack") !== "on") redirect(`/${locale}/studio/products/${productId}?error=ack`);
  try {
    await publishProduct(p, productId);
  } catch (e) {
    redirect(`/${locale}/studio/products/${productId}?error=${e instanceof StudioError ? e.message : "generic"}`);
  }
  revalidatePath(`/${locale}/studio/products/${productId}`);
  redirect(`/${locale}/studio/products/${productId}`);
}

export async function unpublishAction(locale: string, productId: string) {
  const { pro: p } = await pro();
  await db.update(schema.products).set({ status: "draft", updatedAt: new Date() }).where(and(eq(schema.products.id, productId), eq(schema.products.professionalId, p.id)));
  redirect(`/${locale}/studio/products/${productId}`);
}

export async function shareAction(locale: string, productId: string, fd: FormData) {
  const { pro: p } = await pro();
  await createShareLink(p, productId, str(fd, "note") ?? null, Number(str(fd, "maxUses") ?? 1));
  redirect(`/${locale}/studio/products/${productId}#share`);
}

export async function discountAction(locale: string, productId: string, fd: FormData) {
  const { pro: p } = await pro();
  const code = (str(fd, "code") ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
  const percent = Math.min(100, Math.max(1, Number(str(fd, "percentOff") ?? 10)));
  if (code) {
    await db
      .insert(schema.discountCodes)
      .values({ code, professionalId: p.id, productId, percentOff: percent, maxRedemptions: Number(str(fd, "maxRedemptions")) || null })
      .onConflictDoNothing();
  }
  redirect(`/${locale}/studio/products/${productId}#discounts`);
}

export async function saveProfileAction(locale: string, fd: FormData) {
  const { pro: p } = await pro();
  const color = str(fd, "brandColor");
  await db
    .update(schema.professionalProfiles)
    .set({
      displayName: str(fd, "displayName") ?? p.displayName,
      headline: str(fd, "headline") ?? null,
      bio: str(fd, "bio") ?? null,
      credentials: str(fd, "credentials") ?? null,
      website: str(fd, "website") ?? null,
      brandColor: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
      clinicalMode: fd.get("clinicalMode") === "on",
      updatedAt: new Date(),
    })
    .where(eq(schema.professionalProfiles.id, p.id));
  redirect(`/${locale}/studio/settings?saved=1`);
}

export async function connectAction(locale: string) {
  const { user, pro: p } = await pro();
  let url: string;
  try {
    url = await startConnectOnboarding(p, user.email, absoluteUrl(`/${locale}/studio/settings`));
  } catch (e) {
    redirect(`/${locale}/studio/settings?error=${e instanceof StudioError ? e.message : "generic"}`);
  }
  redirect(url);
}

export async function payoutAction(locale: string, fd: FormData) {
  const { pro: p } = await pro();
  try {
    await requestPayout(p, str(fd, "currency") ?? "pln");
  } catch (e) {
    redirect(`/${locale}/studio/settings?error=${e instanceof StudioError ? e.message : "generic"}`);
  }
  redirect(`/${locale}/studio/settings?payout=1`);
}

export async function subscribeProAction(locale: string) {
  const { user } = await pro();
  const market = marketForLocale(locale);
  const offer = (await offersForMarket(market, "professional")).find((o) => o.id === "studio_pro");
  if (!offer) redirect(`/${locale}/studio/settings?error=not_available`);
  let url: string;
  try {
    ({ url } = await startCheckout({
      userId: user.id,
      email: user.email,
      locale,
      kind: "offer",
      offerId: "studio_pro",
      currency: offer.currency ?? currencyForMarket(market),
      amountMinor: offer.amountMinor,
      title: "OpenWithin Studio Pro",
      recurring: "month",
      successPath: `/${locale}/studio/settings`,
      cancelPath: `/${locale}/studio/settings`,
    }));
  } catch {
    redirect(`/${locale}/studio/settings?error=payments_not_configured`);
  }
  redirect(url);
}

export async function voiceCloneAction(locale: string, fd: FormData) {
  const { pro: p } = await pro();
  if (fd.get("consent") !== "on" || fd.get("identity") !== "on") redirect(`/${locale}/studio/settings?error=consent`);
  await db.insert(schema.voiceCloneRequests).values({
    professionalId: p.id,
    consentStatement: "I am the owner of this voice, I consent to it being cloned for my own OpenWithin content, and I accept the voice provider's terms.",
    consentedAt: new Date(),
  });
  redirect(`/${locale}/studio/settings?voice=1`);
}
