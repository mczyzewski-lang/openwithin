import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, getOrCreateAnonId } from "@/server/auth/session";
import { createPreview, ExperienceError } from "@/server/experiences";
import { clientIp } from "@/server/ratelimit";
import { productPreviewLines } from "@/server/studio/products";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  settings: z.unknown(),
  draftId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  locale: z.string().max(5).default("en"),
  source: z.string().max(80).optional(),
});

/** Fast, cheap 15-second personal preview. No account required. */
export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const [user, anonId] = await Promise.all([getCurrentUser(), getOrCreateAnonId()]);
  try {
    let linesOverride: string[] | undefined;
    if (parsed.data.productId) linesOverride = await productPreviewLines(parsed.data.productId, parsed.data.settings);
    const result = await createPreview({
      settings: parsed.data.settings,
      draftId: parsed.data.draftId,
      productId: parsed.data.productId,
      anonId,
      userId: user?.id,
      uiLocale: parsed.data.locale,
      ip: clientIp(req.headers),
      linesOverride,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ExperienceError) {
      const status = e.code === "rate_limited" || e.code === "daily_limit" || e.code === "budget" ? 429 : e.code === "generation_failed" ? 502 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    console.error("[api/preview]", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
