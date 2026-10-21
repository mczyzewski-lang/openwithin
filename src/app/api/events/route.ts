import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { track } from "@/server/analytics/events";
import { getAnonId, getCurrentUser } from "@/server/auth/session";
import { hit, clientIp } from "@/server/ratelimit";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CLIENT_EVENTS = ["preview_played", "product_preview_played", "auth_gate_shown", "generator_started", "landing_view", "product_view"] as const;
const body = z.object({
  name: z.enum(CLIENT_EVENTS),
  techniqueId: z.string().max(40).optional(),
  productId: z.string().uuid().optional(),
  locale: z.string().max(5).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await hit(`events:${clientIp(req.headers)}`, 120, 60)).allowed) return NextResponse.json({ ok: false }, { status: 429 });
  const [user, anonId] = await Promise.all([getCurrentUser(), getAnonId()]);
  let professionalId: string | undefined;
  if (parsed.data.productId) {
    const [p] = await db.select({ pro: schema.products.professionalId }).from(schema.products).where(eq(schema.products.id, parsed.data.productId));
    professionalId = p?.pro;
  }
  await track(parsed.data.name, { userId: user?.id, anonId, techniqueId: parsed.data.techniqueId, productId: parsed.data.productId, professionalId, locale: parsed.data.locale });
  return NextResponse.json({ ok: true });
}
