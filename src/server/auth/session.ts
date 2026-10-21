import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { db, schema } from "../db";
import { features } from "../env";
import { sign, unsign } from "../crypto";
import { grantFreeTrial } from "../billing/entitlements";
import { supabaseServer } from "./supabase";

export const ANON_COOKIE = "ow_anon";
export const DEMO_COOKIE = "ow_demo_session";

export type User = typeof schema.users.$inferSelect;

/** Anonymous visitor id (signed cookie, set by the proxy). Used for the pre-login funnel. */
export async function getAnonId(): Promise<string | null> {
  const store = await cookies();
  return unsign(store.get(ANON_COOKIE)?.value, "anon");
}

export function newAnonCookieValue(): string {
  return sign(randomUUID(), "anon");
}

/** Create the anon id inside a route handler if the proxy did not run (e.g. API-only clients). */
export async function getOrCreateAnonId(): Promise<string> {
  const existing = await getAnonId();
  if (existing) return existing;
  const value = newAnonCookieValue();
  const store = await cookies();
  store.set(ANON_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return unsign(value, "anon")!;
}

export async function ensureUser(input: { provider: "supabase" | "demo"; subject: string; email?: string | null; locale?: string }): Promise<User> {
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.authProvider, input.provider), eq(schema.users.authSubject, input.subject)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(schema.users)
    .values({ authProvider: input.provider, authSubject: input.subject, email: input.email ?? null, uiLocale: input.locale ?? "en" })
    .onConflictDoNothing()
    .returning();
  const user =
    created ??
    (await db.select().from(schema.users).where(and(eq(schema.users.authProvider, input.provider), eq(schema.users.authSubject, input.subject))))[0];
  await db.insert(schema.profiles).values({ userId: user.id }).onConflictDoNothing();
  await grantFreeTrial(user.id);
  return user;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (features.supabaseAuth) {
    const supabase = await supabaseServer();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!data.user) return null;
    return ensureUser({ provider: "supabase", subject: data.user.id, email: data.user.email });
  }
  if (features.demoAuth) {
    const store = await cookies();
    const userId = unsign(store.get(DEMO_COOKIE)?.value, "demo-session");
    if (!userId) return null;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return user ?? null;
  }
  return null;
});

/**
 * Move everything an anonymous visitor created (drafts, preview scenarios, preview audio)
 * to the signed-in account, and prefill the personalization profile from the latest draft.
 * Idempotent.
 */
export async function claimAnonymous(userId: string, anonId: string | null) {
  if (!anonId) return;
  await db.transaction(async (tx) => {
    await tx.update(schema.experienceDrafts).set({ userId }).where(and(eq(schema.experienceDrafts.anonId, anonId), isNull(schema.experienceDrafts.userId)));
    await tx.update(schema.audioScenarios).set({ ownerUserId: userId }).where(and(eq(schema.audioScenarios.anonId, anonId), isNull(schema.audioScenarios.ownerUserId)));
    const previews = await tx
      .update(schema.generatedAudio)
      .set({ ownerUserId: userId, expiresAt: null })
      .where(and(eq(schema.generatedAudio.anonId, anonId), isNull(schema.generatedAudio.ownerUserId)))
      .returning();
    for (const p of previews) {
      const [scenario] = await tx.select().from(schema.audioScenarios).where(eq(schema.audioScenarios.id, p.scenarioId));
      if (!scenario) continue;
      await tx
        .insert(schema.experienceLibrary)
        .values({ userId, generatedAudioId: p.id, title: scenario.title, techniqueId: scenario.techniqueId, source: "preview", saved: false })
        .onConflictDoNothing();
    }
    const [latest] = await tx
      .select()
      .from(schema.experienceDrafts)
      .where(eq(schema.experienceDrafts.userId, userId))
      .orderBy(desc(schema.experienceDrafts.updatedAt))
      .limit(1);
    if (latest) {
      const s = latest.settings as Record<string, unknown>;
      await tx
        .insert(schema.personalizationProfiles)
        .values({
          userId,
          firstName: (s.firstName as string) ?? null,
          nameVocative: (s.addressAs as string) ?? null,
          recordingLanguage: (s.recordingLanguage as string) ?? null,
          voicePresetId: (s.voicePresetId as string) ?? null,
          narrationSpeed: (s.narrationSpeed as string) ?? "calm",
          defaultDurationMin: (s.durationMin as number) ?? 10,
        })
        .onConflictDoNothing();
      await tx.insert(schema.profiles).values({ userId, firstName: (s.firstName as string) ?? null }).onConflictDoUpdate({
        target: schema.profiles.userId,
        set: { firstName: (s.firstName as string) ?? null },
        where: isNull(schema.profiles.firstName),
      });
    }
  });
}

export async function getProfessional(userId: string) {
  const [pro] = await db.select().from(schema.professionalProfiles).where(eq(schema.professionalProfiles.userId, userId)).limit(1);
  return pro ?? null;
}
