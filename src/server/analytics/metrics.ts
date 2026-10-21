import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db";

const one = async <T,>(q: ReturnType<typeof sql>): Promise<T> => ((await db.execute(q)) as unknown as T[])[0];

/**
 * Retention measured from real behaviour: listening, replays, completions, programme
 * continuation and repeat purchases — not from how many files were generated.
 */
export async function platformMetrics() {
  const dayN = (n: number) =>
    one<{ cohort: number; returned: number }>(sql`
      select count(*)::int as cohort,
             count(*) filter (where exists (
               select 1 from analytics_events e
               where e.user_id = u.id
                 and e.name in ('playback_started','replay','return_visit','preview_generated','full_generation_requested')
                 and e.created_at >= u.created_at + make_interval(days => ${n})
                 and e.created_at <  u.created_at + make_interval(days => ${n + 1})
             ))::int as returned
      from users u where u.created_at <= now() - make_interval(days => ${n + 1})`);
  const [d1, d7, d30] = await Promise.all([dayN(1), dayN(7), dayN(30)]);
  const counts = await one<Record<string, number>>(sql`
    select
      count(*) filter (where name = 'preview_generated')::int as previews,
      count(*) filter (where name = 'signup_completed')::int as signups,
      count(*) filter (where name = 'full_generation_completed')::int as full_sessions,
      count(*) filter (where name = 'purchase_completed')::int as purchases,
      count(*) filter (where name = 'playback_started')::int as starts,
      count(*) filter (where name = 'replay')::int as replays,
      count(*) filter (where name = 'playback_completed')::int as completions,
      count(*) filter (where name = 'program_started')::int as programs_started,
      count(*) filter (where name = 'full_generation_requested' and (props->>'regenerate')::boolean)::int as regenerations
    from analytics_events where created_at >= now() - interval '30 days'`);
  const programs = await one<{ continued: number; started: number }>(sql`
    select count(*) filter (where array_length(completed_days, 1) >= 2)::int as continued, count(*)::int as started from program_progress`);
  const buyers = await one<{ repeat: number; total: number }>(sql`
    select count(*) filter (where n > 1)::int as repeat, count(*)::int as total
    from (select user_id, count(*) n from purchases where status = 'paid' group by user_id) x`);
  const creators = await one<{ active: number; total: number; returning_buyers: number }>(sql`
    select
      (select count(distinct professional_id)::int from analytics_events where professional_id is not null and name like 'studio_%' and created_at >= now() - interval '30 days') as active,
      (select count(*)::int from professional_profiles) as total,
      (select count(*)::int from (select professional_id, user_id from purchases where professional_id is not null and status = 'paid' group by 1,2 having count(*) > 1) r) as returning_buyers`);
  const cost = await one<{ chars: number; cached: number; usd: number }>(sql`
    select coalesce(sum(units) filter (where provider = 'elevenlabs' and not cached), 0)::int as chars,
           coalesce(sum(units) filter (where cached), 0)::int as cached,
           coalesce(sum(est_cost_microusd), 0)::float / 1e6 as usd
    from usage_ledger where created_at >= now() - interval '24 hours'`);
  const rate = (a: number, b: number) => (b ? a / b : 0);
  return {
    retention: { d1: rate(d1.returned, d1.cohort), d7: rate(d7.returned, d7.cohort), d30: rate(d30.returned, d30.cohort), cohorts: { d1: d1.cohort, d7: d7.cohort, d30: d30.cohort } },
    funnel: counts,
    replayRate: rate(counts.replays, counts.starts + counts.replays),
    completionRate: rate(counts.completions, counts.starts + counts.replays),
    programContinuation: rate(programs.continued, programs.started),
    repeatPurchaseRate: rate(buyers.repeat, buyers.total),
    creators,
    cost,
  };
}
