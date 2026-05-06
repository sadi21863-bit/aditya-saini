/**
 * scripts/process-queue.ts
 *
 * Queue processor for GitHub Actions (no function timeout).
 * Self-healing: checks whether today's theme and ideas have been seeded
 * and queues them if missing — so a missed Vercel cron is recovered within
 * the next 5-minute GHA run, without any manual intervention.
 *
 * Usage: npx tsx scripts/process-queue.ts
 *
 * Required env vars (set as GitHub Secrets):
 *   DATABASE_URL, GROQ_API_KEY, GH_MODELS_TOKEN, AI_LAB_ROOM_ID, AI_LAB_ENABLED
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { processQueue, resetStuckQueueItems } from "@/lib/agents/executor";
import { queueThemeSelection, queueDailyIdeas, queueDailyArchive } from "@/lib/agents/scheduler";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const rawDb  = drizzle(client);

/** yyyy-mm-dd in UTC — matches how AI Lab crons schedule work */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Self-healing check: if today's theme or ideas are missing from the queue
 * and the DB, queue them now. This recovers from missed Vercel crons without
 * any manual intervention, within the next 5-minute GHA window.
 */
async function ensureDailyWorkQueued(): Promise<void> {
  const today = todayUTC();

  // ── Theme ────────────────────────────────────────────────────────────
  // Check if today's theme already exists in ai_themes (already processed)
  // or if a theme_select item is already in the queue (pending/in-progress)
  const [themeInDb] = await rawDb.execute(sql`
    SELECT 1 FROM ai_themes WHERE date = ${today} LIMIT 1
  `) as unknown as [unknown?];

  const [themeInQueue] = await rawDb.execute(sql`
    SELECT 1 FROM ai_queue
    WHERE  action_type   = 'theme_select'
      AND  scheduled_for >= (${today}::date)
      AND  status        IN ('pending', 'in_progress', 'done')
    LIMIT 1
  `) as unknown as [unknown?];

  if (!themeInDb && !themeInQueue) {
    console.log(`[process-queue] No theme for ${today} — queuing theme selection`);
    await queueThemeSelection();
  }

  // ── Ideas ────────────────────────────────────────────────────────────
  // Only seed ideas once the theme is in the DB (ideas reference the theme).
  if (themeInDb) {
    const [ideasInQueue] = await rawDb.execute(sql`
      SELECT 1 FROM ai_queue
      WHERE  action_type = 'post_idea'
        AND  created_at  >= (${today}::date)
      LIMIT 1
    `) as unknown as [unknown?];

    if (!ideasInQueue) {
      console.log(`[process-queue] No ideas queued for ${today} — queuing daily ideas`);
      await queueDailyIdeas();
    }
  }

  // ── Archive ───────────────────────────────────────────────────────────
  // Check yesterday's archive: if there is no completed archive_day for
  // yesterday, queue it (covers the case where the 17:30 UTC cron was missed).
  const nowUTC   = new Date();
  const yesterday = new Date(Date.UTC(
    nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate() - 1,
  ));
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [yesterdayArchive] = await rawDb.execute(sql`
    SELECT 1 FROM ai_queue
    WHERE  action_type         = 'archive_day'
      AND  prompt_context->>'date' = ${yesterdayStr}
      AND  status              IN ('pending', 'in_progress', 'done')
    LIMIT 1
  `) as unknown as [unknown?];

  if (!yesterdayArchive) {
    console.log(`[process-queue] No archive for ${yesterdayStr} — queuing archive`);
    await queueDailyArchive(yesterdayStr);
  }

  // Check today's archive: only attempt after 18:00 UTC (30-min buffer past the 17:30 cron).
  if (nowUTC.getUTCHours() >= 18) {
    const [todayArchive] = await rawDb.execute(sql`
      SELECT 1 FROM ai_queue
      WHERE  action_type         = 'archive_day'
        AND  prompt_context->>'date' = ${today}
        AND  status              IN ('pending', 'in_progress', 'done')
      LIMIT 1
    `) as unknown as [unknown?];

    if (!todayArchive) {
      console.log(`[process-queue] No archive for ${today} — queuing archive`);
      await queueDailyArchive(today);
    }
  }
}

async function main() {
  if (process.env.AI_LAB_ENABLED !== "true") {
    console.log("[process-queue] AI_LAB_ENABLED is not 'true' — skipping.");
    await client.end();
    return;
  }

  // 1. Self-heal: ensure today's theme and ideas are queued
  await ensureDailyWorkQueued();

  // 2. Reset any items stuck in_progress from a previous timeout
  const recovered = await resetStuckQueueItems();
  if (recovered > 0) {
    console.log(`[process-queue] Reset ${recovered} stuck in_progress item(s)`);
  }

  // 3. Advance all overdue pending items to now() so processQueue picks them up
  const advanced = await rawDb.execute(sql`
    UPDATE ai_queue
    SET    scheduled_for = now()
    WHERE  status        = 'pending'
      AND  scheduled_for > now()
  `);
  const advancedCount = (advanced as { rowCount?: number }).rowCount ?? 0;
  if (advancedCount > 0) {
    console.log(`[process-queue] Advanced ${advancedCount} pending item(s) to now()`);
  }

  // 4. Drain the queue in batches (max 5 passes per run to stay within GHA limits)
  let totalProcessed = 0;
  let totalFailed    = 0;
  const allErrors: Array<{ id: string; agentId: string; actionType: string; error: string }> = [];

  for (let pass = 0; pass < 5; pass++) {
    const result = await processQueue(10);
    totalProcessed += result.processed;
    totalFailed    += result.failed;
    allErrors.push(...result.errors);

    if (result.processed === 0 && result.failed === 0) break;

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`[process-queue] Finished — processed: ${totalProcessed}, failed: ${totalFailed}`);
  if (allErrors.length > 0) {
    console.log("[process-queue] Failed items:");
    for (const e of allErrors) {
      console.log(`  • [${e.actionType}] agent=${e.agentId} id=${e.id} — ${e.error}`);
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error("[process-queue] Fatal:", err);
  process.exit(1);
});
