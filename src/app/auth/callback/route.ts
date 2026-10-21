import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/server/db";
import { claimAnonymous, ensureUser, getAnonId } from "@/server/auth/session";
import { supabaseServer } from "@/server/auth/supabase";
import { track } from "@/server/analytics/events";

export const dynamic = "force-dynamic";

/** OAuth / magic-link return URL for Supabase Auth. Keeps the funnel: claims the anonymous draft and preview. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/en/space";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/en/space";
  const locale = next.split("/")[1] || "en";
  const supabase = await supabaseServer();
  if (!supabase || !code) return NextResponse.redirect(new URL(`/${locale}/login?error=auth`, req.url));
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL(`/${locale}/login?error=auth`, req.url));
  const user = await ensureUser({ provider: "supabase", subject: data.user.id, email: data.user.email, locale });
  const marketing = req.nextUrl.searchParams.get("marketing") === "1";
  await db.insert(schema.consents).values([
    { userId: user.id, kind: "terms", version: "2026-10", granted: true },
    { userId: user.id, kind: "marketing", version: "2026-10", granted: marketing },
  ]);
  await claimAnonymous(user.id, await getAnonId());
  if (Date.now() - user.createdAt.getTime() < 120_000) await track("signup_completed", { userId: user.id, props: { provider: data.user.app_metadata?.provider ?? "email" } });
  return NextResponse.redirect(new URL(next, req.url));
}
