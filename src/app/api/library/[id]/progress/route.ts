import { NextResponse, type NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { track } from "@/server/analytics/events";
import { getCurrentUser } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { markProgramProgress } from "@/server/programs";

export const dynamic = "force-dynamic";

const body = z.object({ positionMs: z.number().int().min(0).max(4 * 3600_000), event: z.enum(["start", "complete"]).optional() });

/** Remembers playback position; records real listening behaviour (starts, replays, completions). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const [item] = await db.select().from(schema.experienceLibrary).where(and(eq(schema.experienceLibrary.id, id), eq(schema.experienceLibrary.userId, user.id)));
  if (!item) return NextResponse.json({ ok: false }, { status: 404 });

  const { positionMs, event } = parsed.data;
  await db
    .update(schema.experienceLibrary)
    .set({
      lastPositionMs: event === "complete" ? 0 : positionMs,
      lastPlayedAt: new Date(),
      ...(event === "start" ? { playCount: sql`${schema.experienceLibrary.playCount} + 1` } : {}),
      ...(event === "complete" ? { completedCount: sql`${schema.experienceLibrary.completedCount} + 1` } : {}),
    })
    .where(eq(schema.experienceLibrary.id, id));

  if (event === "start") {
    await track(item.playCount > 0 ? "replay" : "playback_started", { userId: user.id, techniqueId: item.techniqueId, productId: item.productId, props: { libraryId: id } });
  }
  if (event === "complete") {
    await track("playback_completed", { userId: user.id, techniqueId: item.techniqueId, productId: item.productId, props: { libraryId: id } });
    if (item.programId && item.programDay) await markProgramProgress(user.id, item.programId, item.programDay);
  }
  return NextResponse.json({ ok: true });
}
