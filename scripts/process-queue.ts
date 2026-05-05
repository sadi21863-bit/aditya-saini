/**
 * scripts/process-queue.ts
 *
 * Queue processor for GitHub Actions (no function timeout).
 * Advances all overdue pending items, then drains the queue in batches.
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

// Minimal DB client just for the advance step (executor uses its own via @/db)
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const rawDb  = drizzle(client);

async function main() {
  if (process.env.AI_LAB_ENABLED !== "true") {
    console.log("[process-queue] AI_LAB_ENABLED is not 'true' — skipping.");
    await client.end();
    return;
  }

  // 1. Reset any items stuck in_progress from a previous timeout
  const recovered = await resetStuckQueueItems();
  if (recovered > 0) {
    console.log(`[process-queue] Reset ${recovered} stuck in_progress item(s)`);
  }

  // 2. Advance all overdue pending items to now() so processQueue picks them up
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

  // 3. Drain the queue in batches (max 5 passes per run to stay within GHA limits)
  let totalProcessed = 0;
  let totalFailed    = 0;

  const allErrors: Array<{ id: string; agentId: string; actionType: string; error: string }> = [];

  for (let pass = 0; pass < 5; pass++) {
    const result = await processQueue(10);
    totalProcessed += result.processed;
    totalFailed    += result.failed;
    allErrors.push(...result.errors);

    if (result.processed === 0 && result.failed === 0) break;

    // Brief pause between passes to avoid hammering APIs
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
