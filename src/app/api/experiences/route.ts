import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { claimAnonymous, getAnonId, getCurrentUser } from "@/server/auth/session";
import { ExperienceError, requestFullExperience } from "@/server/experiences";
import { hit } from "@/server/ratelimit";

export const dynamic = "force-dynamic";

const body = z.object({
  draftId: z.string().uuid(),
  durationMin: z.number().int().min(3).max(60).optional(),
  regenerate: z.boolean().optional(),
});

/** Queue a full personal session. Generation runs in the background worker, never in this request. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!(await hit(`full:${user.id}`, 20, 3600)).allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  await claimAnonymous(user.id, await getAnonId());
  try {
    const result = await requestFullExperience({ userId: user.id, ...parsed.data });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ExperienceError) return NextResponse.json({ error: e.code }, { status: e.code === "not_found" ? 404 : 400 });
    console.error("[api/experiences]", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
