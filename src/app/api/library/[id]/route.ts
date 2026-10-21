import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { track } from "@/server/analytics/events";
import { getCurrentUser } from "@/server/auth/session";
import { db, schema } from "@/server/db";

export const dynamic = "force-dynamic";

const body = z.object({ isFavorite: z.boolean().optional(), saved: z.boolean().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const [row] = await db
    .update(schema.experienceLibrary)
    .set(parsed.data)
    .where(and(eq(schema.experienceLibrary.id, id), eq(schema.experienceLibrary.userId, user.id)))
    .returning();
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });
  if (parsed.data.isFavorite) await track("favorite_added", { userId: user.id, techniqueId: row.techniqueId });
  return NextResponse.json({ ok: true, item: { isFavorite: row.isFavorite, saved: row.saved } });
}

/** Removes the item from the library and deletes the generated file if nobody else references it. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const [row] = await db.delete(schema.experienceLibrary).where(and(eq(schema.experienceLibrary.id, id), eq(schema.experienceLibrary.userId, user.id))).returning();
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true });
}
