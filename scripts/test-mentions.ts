/**
 * Manual verification script for Week 3 mention handling.
 * Tests all scenarios from Step 10 without a browser.
 *
 * Run: npx tsx scripts/test-mentions.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const client  = postgres(process.env.DATABASE_URL!, { prepare: false });
const db      = drizzle(client);
const SECRET  = process.env.CRON_SECRET!;
const BASE    = "http://localhost:3001";

async function post(path: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body:    JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({ _raw: await r.text().catch(() => "") }));
  return { status: r.status, body: json };
}

async function queryTable(query: string) {
  return db.execute(sql.raw(query));
}

async function main() {
  console.log("=== Week 3 Manual Verification ===\n");

  // ── 1. Scenario: private-choice in public room ─────────────────────
  console.log("── Scenario 1: public room, private choice ──────────────");
  const theme1 = await post("/api/cron/agents/theme");
  console.log("theme cron:", theme1.body);
  await post("/api/cron/agents/tick");

  // Simulate queueing a mention_response (private choice) by inserting directly
  const { default: pClient } = await import("postgres");
  const rawClient = pClient(process.env.DATABASE_URL!, { prepare: false });
  const labRoomId = process.env.AI_LAB_ROOM_ID!;

  // Check how many mention_response rows exist in queue
  const qRows = await queryTable(
    `SELECT action_type, prompt_context->>'kind' as kind,
            prompt_context->>'echo_to_lab' as echo_to_lab,
            prompt_context->>'is_private_room' as is_private_room,
            status
     FROM ai_queue
     WHERE action_type = 'comment'
       AND prompt_context->>'kind' = 'mention_response'
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log("\nMention-response queue rows:");
  for (const r of qRows as unknown[]) console.log(" ", r);

  // ── 2. Check ai_moderation_log for isolation events ────────────────
  console.log("\n── Moderation log (isolation events) ─────────────────��──");
  const modLog = await queryTable(
    `SELECT moderator_agent_id, target_type, verdict, reason, reviewed_at
     FROM ai_moderation_log
     WHERE verdict = 'isolated'
     ORDER BY reviewed_at DESC LIMIT 5`
  );
  for (const r of modLog as unknown[]) console.log(" ", r);

  // ── 3. Rate limit check (via direct DB query) ─────────────────────
  console.log("\n── Rate limit state ────────────────��─────────────────────");
  const rateRows = await queryTable(
    `SELECT prompt_context->>'mention_user_id' as user_id, COUNT(*) as count
     FROM ai_queue
     WHERE action_type = 'comment'
       AND prompt_context->>'kind' = 'mention_response'
       AND created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY 1`
  );
  for (const r of rateRows as unknown[]) console.log(" ", r);

  // ── 4. Lab ideas (check no private-room ideas leaked) ─────────────
  console.log("\n── AI Lab ideas ──────────────────���───────────────────────");
  const labIdeas = await queryTable(
    `SELECT id, SUBSTRING(title,1,60) as title, user_id, action_type
     FROM ideas i
     LEFT JOIN ai_queue q ON q.result_idea_id = i.id
     WHERE i.room_id = '${labRoomId}'
     ORDER BY i.created_at DESC LIMIT 5`
  );
  for (const r of labIdeas as unknown[]) console.log(" ", r);

  await rawClient.end();
  await client.end();
  console.log("\n=== Done ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
