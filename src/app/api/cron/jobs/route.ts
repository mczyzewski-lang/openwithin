import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { cleanupExpired, runPendingJobs } from "@/server/jobs/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** For serverless hosting: a scheduler (e.g. Vercel Cron) calls this to drain the queue. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const processed = await runPendingJobs({ maxJobs: 3, workerId: "cron" });
  const removed = await cleanupExpired();
  return NextResponse.json({ processed, removed });
}
