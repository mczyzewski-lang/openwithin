import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { db, schema } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [job] = await db
    .select({ id: schema.generationJobs.id, status: schema.generationJobs.status, progress: schema.generationJobs.progress, audioId: schema.generationJobs.generatedAudioId, attempts: schema.generationJobs.attempts })
    .from(schema.generationJobs)
    .where(and(eq(schema.generationJobs.id, id), eq(schema.generationJobs.userId, user.id)));
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let libraryId: string | null = null;
  if (job.audioId) {
    const [lib] = await db
      .select({ id: schema.experienceLibrary.id })
      .from(schema.experienceLibrary)
      .where(and(eq(schema.experienceLibrary.userId, user.id), eq(schema.experienceLibrary.generatedAudioId, job.audioId)));
    libraryId = lib?.id ?? null;
  }
  return NextResponse.json({ ...job, libraryId });
}
