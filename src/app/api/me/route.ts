import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCurrentUser, getProfessional } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ signedIn: false });
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  const pro = await getProfessional(user.id);
  return NextResponse.json({ signedIn: true, firstName: profile?.firstName ?? null, isProfessional: !!pro });
}
