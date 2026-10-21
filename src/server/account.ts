import "server-only";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db, schema } from "./db";
import { env } from "./env";
import { storage } from "./storage";

/** Right to erasure: removes audio files, all rows (cascade) and the auth identity. */
export async function deleteAccount(userId: string) {
  const files = await db.select({ key: schema.generatedAudio.storageKey }).from(schema.generatedAudio).where(eq(schema.generatedAudio.ownerUserId, userId));
  await storage().remove(files.map((f) => f.key));
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  if (user?.authProvider === "supabase" && env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.auth.admin.deleteUser(user.authSubject).catch((e) => console.error("[account] auth delete failed", e));
  }
}

export async function deletePersonalization(userId: string) {
  await db.delete(schema.personalContextItems).where(eq(schema.personalContextItems.userId, userId));
  await db.delete(schema.personalizationProfiles).where(eq(schema.personalizationProfiles.userId, userId));
}

export async function exportAccount(userId: string) {
  const q = <T,>(p: Promise<T>) => p;
  const [user, profile, personalization, context, drafts, library, purchases, entitlements, consents] = await Promise.all([
    q(db.select().from(schema.users).where(eq(schema.users.id, userId))),
    q(db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId))),
    q(db.select().from(schema.personalizationProfiles).where(eq(schema.personalizationProfiles.userId, userId))),
    q(db.select().from(schema.personalContextItems).where(eq(schema.personalContextItems.userId, userId))),
    q(db.select().from(schema.experienceDrafts).where(eq(schema.experienceDrafts.userId, userId))),
    q(db.select().from(schema.experienceLibrary).where(eq(schema.experienceLibrary.userId, userId))),
    q(db.select().from(schema.purchases).where(eq(schema.purchases.userId, userId))),
    q(db.select().from(schema.entitlements).where(eq(schema.entitlements.userId, userId))),
    q(db.select().from(schema.consents).where(eq(schema.consents.userId, userId))),
  ]);
  return { exportedAt: new Date().toISOString(), user: user[0], profile: profile[0], personalization: personalization[0], context, drafts, library, purchases, entitlements, consents };
}
