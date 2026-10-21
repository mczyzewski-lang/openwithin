import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { claimAnonymous, DEMO_COOKIE, ensureUser, getAnonId } from "@/server/auth/session";
import { sign } from "@/server/crypto";
import { features } from "@/server/env";
import { track } from "@/server/analytics/events";

export const dynamic = "force-dynamic";

/**
 * DEMO MODE ONLY — passwordless local sign-in without Supabase. Disabled automatically
 * once Supabase Auth is configured. Never use with real users.
 */
export async function POST(req: NextRequest) {
  if (!features.demoAuth) return NextResponse.json({ error: "not_available" }, { status: 404 });
  const parsed = z
    .object({ email: z.string().email().max(200), locale: z.string().max(5).default("en"), marketing: z.boolean().default(false), terms: z.literal(true) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const user = await ensureUser({ provider: "demo", subject: email, email, locale: parsed.data.locale });
  await db.insert(schema.consents).values([
    { userId: user.id, kind: "terms", version: "2026-10", granted: true },
    { userId: user.id, kind: "marketing", version: "2026-10", granted: parsed.data.marketing },
  ]);
  const store = await cookies();
  store.set(DEMO_COOKIE, sign(user.id, "demo-session"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  await claimAnonymous(user.id, await getAnonId());
  if (Date.now() - user.createdAt.getTime() < 120_000) await track("signup_completed", { userId: user.id, props: { provider: "demo" } });
  return NextResponse.json({ ok: true });
}
