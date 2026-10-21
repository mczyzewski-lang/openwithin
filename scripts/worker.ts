import "dotenv/config";
import { cleanupExpired, runPendingJobs } from "@/server/jobs/worker";

/**
 * Standalone audio worker. Run one or more of these next to the web app:
 *   npm run worker
 * Jobs are claimed from Postgres with SKIP LOCKED, so workers scale horizontally.
 */
let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

const id = `worker-${process.pid}`;
let lastCleanup = 0;
console.log(`[${id}] started`);
while (!stopping) {
  try {
    const n = await runPendingJobs({ maxJobs: 5, workerId: id });
    if (Date.now() - lastCleanup > 3600_000) {
      const removed = await cleanupExpired();
      if (removed) console.log(`[${id}] removed ${removed} expired previews`);
      lastCleanup = Date.now();
    }
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  } catch (e) {
    console.error(`[${id}] loop error`, e);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
console.log(`[${id}] stopped`);
process.exit(0);
