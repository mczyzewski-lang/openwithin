import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/server/auth/session";
import { supabaseServer } from "@/server/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await supabaseServer();
  await supabase?.auth.signOut();
  (await cookies()).delete(DEMO_COOKIE);
  return NextResponse.json({ ok: true });
}
