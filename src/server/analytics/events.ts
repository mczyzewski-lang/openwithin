import "server-only";
import { db, schema } from "../db";

/**
 * Behavioural events. Retention is measured from real listening behaviour
 * (replays, completions, programme continuation, repeat purchases) — not from
 * how many files get generated. See src/server/analytics/metrics.ts.
 */
export const EVENT_NAMES = [
  "landing_view",
  "generator_started",
  "preview_requested",
  "preview_generated",
  "preview_played",
  "auth_gate_shown",
  "signup_completed",
  "full_generation_requested",
  "full_generation_completed",
  "full_generation_failed",
  "playback_started",
  "playback_completed",
  "replay",
  "checkout_started",
  "purchase_completed",
  "program_started",
  "program_day_completed",
  "product_view",
  "product_preview_played",
  "studio_product_published",
  "studio_sample_generated",
  "return_visit",
  "favorite_added",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export async function track(
  name: EventName,
  data: {
    userId?: string | null;
    anonId?: string | null;
    professionalId?: string | null;
    productId?: string | null;
    techniqueId?: string | null;
    locale?: string | null;
    props?: Record<string, unknown>;
  } = {},
) {
  try {
    await db.insert(schema.analyticsEvents).values({
      name,
      userId: data.userId ?? null,
      anonId: data.anonId ?? null,
      professionalId: data.professionalId ?? null,
      productId: data.productId ?? null,
      techniqueId: data.techniqueId ?? null,
      locale: data.locale ?? null,
      props: data.props ?? null,
    });
  } catch (e) {
    console.error("[analytics] failed to record", name, e);
  }
}
