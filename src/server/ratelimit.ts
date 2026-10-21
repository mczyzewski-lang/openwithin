import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Fixed-window counter in Postgres (works across instances without Redis).
 * Returns true when the action is allowed and increments the counter.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; count: number }> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [schema.rateLimits.key, schema.rateLimits.windowStart], set: { count: sql`${schema.rateLimits.count} + 1` } })
    .returning({ count: schema.rateLimits.count });
  return { allowed: row.count <= limit, count: row.count };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? headers.get("x-real-ip") ?? "unknown").trim();
}
