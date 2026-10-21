import "server-only";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "../db";

export const FREE_TRIAL_MAX_MIN = 5;

type Executor = typeof db | Tx;

/** One free session (≤ 5 min) per account, granted exactly once. */
export async function grantFreeTrial(userId: string, exec: Executor = db) {
  const updated = await exec
    .update(schema.users)
    .set({ freeSessionGrantedAt: new Date() })
    .where(and(eq(schema.users.id, userId), isNull(schema.users.freeSessionGrantedAt)))
    .returning({ id: schema.users.id });
  if (!updated.length) return null;
  const [ent] = await exec
    .insert(schema.entitlements)
    .values({ userId, source: "free_trial", kind: "session_credits", creditsTotal: 1, maxDurationMin: FREE_TRIAL_MAX_MIN })
    .returning();
  return ent;
}

const usable = (userId: string) =>
  and(
    eq(schema.entitlements.userId, userId),
    isNull(schema.entitlements.revokedAt),
    sql`${schema.entitlements.creditsUsed} < ${schema.entitlements.creditsTotal}`,
    or(isNull(schema.entitlements.validUntil), gt(schema.entitlements.validUntil, new Date())),
  );

export async function listUsableCredits(userId: string, exec: Executor = db) {
  return exec
    .select()
    .from(schema.entitlements)
    .where(and(usable(userId), eq(schema.entitlements.kind, "session_credits")))
    .orderBy(asc(schema.entitlements.maxDurationMin), asc(schema.entitlements.createdAt));
}

/** The smallest credit that covers the requested duration (free trial is used first). */
export async function findCreditFor(userId: string, durationMin: number, exec: Executor = db) {
  const credits = await listUsableCredits(userId, exec);
  return credits.find((c) => c.maxDurationMin >= durationMin) ?? null;
}

export async function findProductAccess(userId: string, productId: string, exec: Executor = db) {
  const [row] = await exec
    .select()
    .from(schema.entitlements)
    .where(and(eq(schema.entitlements.userId, userId), eq(schema.entitlements.productId, productId), isNull(schema.entitlements.revokedAt)))
    .limit(1);
  return row ?? null;
}

/** Atomically consume one credit. Returns false when it was already used (no double spending). */
export async function consumeCredit(entitlementId: string, exec: Executor = db): Promise<boolean> {
  const rows = await exec
    .update(schema.entitlements)
    .set({ creditsUsed: sql`${schema.entitlements.creditsUsed} + 1` })
    .where(and(eq(schema.entitlements.id, entitlementId), sql`${schema.entitlements.creditsUsed} < ${schema.entitlements.creditsTotal}`, isNull(schema.entitlements.revokedAt)))
    .returning({ id: schema.entitlements.id });
  return rows.length === 1;
}

export async function refundCredit(entitlementId: string, exec: Executor = db) {
  await exec
    .update(schema.entitlements)
    .set({ creditsUsed: sql`greatest(${schema.entitlements.creditsUsed} - 1, 0)` })
    .where(eq(schema.entitlements.id, entitlementId));
}

export async function creditSummary(userId: string) {
  const credits = await listUsableCredits(userId);
  return {
    total: credits.reduce((a, c) => a + (c.creditsTotal - c.creditsUsed), 0),
    maxDurationMin: credits.reduce((a, c) => Math.max(a, c.maxDurationMin), 0),
    hasFreeTrial: credits.some((c) => c.source === "free_trial"),
  };
}
