import "dotenv/config";
import { sql } from "drizzle-orm";
import { SYSTEM_PROGRAMS } from "@/content/programs";
import { TECHNIQUE_IDS, TECHNIQUES } from "@/content/techniques/registry";
import { db, schema } from "@/server/db";
import { DEFAULT_COMMISSION, SEED_OFFERS, SEED_PRICES } from "@/server/billing/pricing";
import { DEFAULT_VOICES } from "@/server/voices";

/** Idempotent seed: catalogue, voices, offers & prices, commission settings, system programs. */
async function main() {
  for (const v of DEFAULT_VOICES) {
    await db
      .insert(schema.voicePresets)
      .values({ ...v, provider: "elevenlabs", languages: ["en", "pl", "es"], settings: { stability: 0.6, similarity_boost: 0.75, style: 0.15 } })
      .onConflictDoNothing();
  }
  for (const [i, id] of TECHNIQUE_IDS.entries()) {
    await db.insert(schema.experienceTypes).values({ id, category: TECHNIQUES[id].category, sort: i }).onConflictDoNothing();
  }
  for (const o of SEED_OFFERS) await db.insert(schema.offers).values({ ...o }).onConflictDoNothing();
  for (const p of SEED_PRICES) await db.insert(schema.offerPrices).values(p).onConflictDoNothing();
  await db.insert(schema.platformSettings).values({ key: "commission_bps", value: DEFAULT_COMMISSION }).onConflictDoNothing();

  for (const p of SYSTEM_PROGRAMS) {
    const [program] = await db
      .insert(schema.programs)
      .values({ key: p.key, title: p.title.en, description: p.description.en, days: p.days.length })
      .onConflictDoUpdate({ target: schema.programs.key, set: { days: p.days.length } })
      .returning();
    for (const [i, day] of p.days.entries()) {
      await db
        .insert(schema.programSessions)
        .values({ programId: program.id, dayIndex: i + 1, techniqueId: day.technique, title: day.focus.en, durationMin: day.durationMin, focus: day.focus.en })
        .onConflictDoNothing();
    }
  }
  const [{ count }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from voice_presets`) as unknown as { count: number }[];
  console.log(`✓ seed complete (${count} voices, ${TECHNIQUE_IDS.length} techniques, ${SYSTEM_PROGRAMS.length} programs)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
