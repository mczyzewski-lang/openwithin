import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";

export async function recordUsage(entry: {
  provider: "elevenlabs" | "anthropic" | "demo";
  purpose: "preview" | "full" | "studio_sample" | "script";
  units: number;
  estCostMicrousd?: number;
  userId?: string | null;
  anonId?: string | null;
  jobId?: string | null;
  cached?: boolean;
}) {
  await db.insert(schema.usageLedger).values({
    provider: entry.provider,
    purpose: entry.purpose,
    units: entry.units,
    estCostMicrousd: entry.estCostMicrousd ?? 0,
    userId: entry.userId ?? null,
    anonId: entry.anonId ?? null,
    jobId: entry.jobId ?? null,
    cached: entry.cached ?? false,
  });
}

/** Characters synthesized by the TTS provider in the last 24h (cache hits excluded). */
export async function ttsCharsLast24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.usageLedger.units}), 0)::int` })
    .from(schema.usageLedger)
    .where(and(eq(schema.usageLedger.provider, "elevenlabs"), eq(schema.usageLedger.cached, false), gte(schema.usageLedger.createdAt, since)));
  return row?.total ?? 0;
}

export class BudgetExceededError extends Error {
  constructor() {
    super("tts_budget_exceeded");
  }
}

/** Global cost guard: refuse new synthesis when the daily character budget is spent. */
export async function assertTtsBudget(additionalChars: number) {
  const used = await ttsCharsLast24h();
  if (used + additionalChars > env.TTS_DAILY_CHAR_BUDGET) throw new BudgetExceededError();
}
