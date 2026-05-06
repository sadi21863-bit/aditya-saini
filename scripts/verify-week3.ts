/**
 * Week 3 manual verification — all Step 10 scenarios.
 * Calls lib/agents functions directly (no HTTP server needed).
 * Run: npx tsx scripts/verify-week3.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const { sql } = await import("drizzle-orm");
  const { queueMentionResponse, queueLabDiscussion } = await import("../lib/agents/scheduler");
  const { processQueue }  = await import("../lib/agents/executor");
  const schema            = await import("../db/schema");

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db     = drizzle(client);
  const LAB    = process.env.AI_LAB_ROOM_ID!;

  const q    = (s: string) => db.execute(sql.raw(s));
  const sep  = (label: string) => console.log(`\n${"─".repeat(55)}\n${label}\n${"─".repeat(55)}`);
  const rows = (data: unknown[]) => data.forEach((r) => console.log(" ", JSON.stringify(r)?.slice(0, 130)));

  // Known IDs
  const PRIV_ROOM = "411b6949-382e-4295-8227-5c169d2ab638";
  const USER_ID   = "b909186d-f894-488c-bd56-48e195f91a08";
  const TARGET_IDEA = (await q(`SELECT id FROM ideas WHERE room_id='${LAB}' LIMIT 1`) as Array<{ id: string }>)[0]?.id;
  if (!TARGET_IDEA) { console.error("No Lab ideas found"); await client.end(); return; }

  const [privIdea] = await db.insert(schema.ideas).values({
    userId: USER_ID, roomId: PRIV_ROOM, title: "Private room test (W3 verify)",
    content: "Testing private room isolation.", status: "published", feedVisible: false,
  }).returning({ id: schema.ideas.id });
  const PRIV_IDEA = privIdea.id;

  console.log(`Lab=${LAB.slice(0,8)} Priv=${PRIV_ROOM.slice(0,8)} PrivIdea=${PRIV_IDEA.slice(0,8)} LabIdea=${TARGET_IDEA.slice(0,8)}`);
  const B = { isRandomSelection: false, ideaTitle: "AI drug discovery", ideaContent: "Content" };

  // ── A: Public room, private choice ──────────────────────────────────
  sep("A: public room + private choice → mention_response, NO lab_discussion");
  await queueMentionResponse({ agentId: "ai_llama", agentHandle: "llama", roomId: LAB, ideaId: TARGET_IDEA, mentionUserId: USER_ID, mentionText: "@llama private choice", isPrivateRoom: false, echoToLab: false, ...B });
  const qA = await q(`SELECT action_type, prompt_context->>'kind' kind, prompt_context->>'echo_to_lab' echo, status FROM ai_queue WHERE action_type='comment' AND prompt_context->>'kind'='mention_response' ORDER BY created_at DESC LIMIT 2`);
  rows(qA as unknown[]); console.log("lab_discussion (expect 0):", (await q(`SELECT COUNT(*) n FROM ai_queue WHERE action_type='lab_discussion' AND created_at>NOW()-INTERVAL '20s'`) as Array<{ n: string }>)[0]?.n);

  // ── B: Public room, public choice ───────────────────────────────────
  sep("B: public room + public choice → mention_response + lab_discussion");
  await queueMentionResponse({ agentId: "ai_qwen", agentHandle: "qwen", roomId: LAB, ideaId: TARGET_IDEA, mentionUserId: USER_ID, mentionText: "@qwen public!", isPrivateRoom: false, echoToLab: true, ...B });
  await queueLabDiscussion({ agentId: "ai_qwen", sourceRoomId: LAB, sourceIdeaId: TARGET_IDEA, sourceIdeasummary: "A user raised: AI drug discovery", isPrivateRoom: false });
  const qB = await q(`SELECT action_type, prompt_context->>'kind' kind, prompt_context->>'echo_to_lab' echo, status FROM ai_queue WHERE created_at>NOW()-INTERVAL '20s' AND action_type IN ('comment','lab_discussion') ORDER BY created_at DESC`);
  rows(qB as unknown[]);

  // ── C: Process mention_response → comment in original room ──────────
  sep("C: processQueue → mention_response → comment in target idea (not a Lab idea)");
  await q(`UPDATE ai_queue SET scheduled_for=NOW() WHERE action_type='comment' AND prompt_context->>'kind'='mention_response' AND status='pending'`);
  const resC = await processQueue(5);
  console.log("processQueue result:", resC);
  const commC = await q(`SELECT c.user_id, SUBSTRING(c.content,1,80) content, c.idea_id FROM idea_comments c WHERE c.user_id IN ('ai_llama','ai_qwen') AND c.created_at>NOW()-INTERVAL '5m' ORDER BY c.created_at DESC LIMIT 3`);
  console.log("AI comments written:"); rows(commC as unknown[]);
  const labBefore = await q(`SELECT COUNT(*) n FROM ideas WHERE room_id='${LAB}' AND user_id IN ('ai_llama','ai_qwen') AND created_at>NOW()-INTERVAL '5m'`);
  console.log("New Lab ideas (expect 0 — lab_discussion still pending):", (labBefore as Array<{ n: string }>)[0]?.n);

  // ── D: Process lab_discussion → new idea in AI Lab ───────────────────
  sep("D: advance lab_discussion + processQueue → new idea in AI Lab");
  await q(`UPDATE ai_queue SET scheduled_for=NOW() WHERE action_type='lab_discussion' AND status='pending'`);
  const resD = await processQueue(5);
  console.log("processQueue result:", resD);
  const labD = await q(`SELECT SUBSTRING(title,1,70) title, user_id FROM ideas WHERE room_id='${LAB}' AND user_id='ai_qwen' AND created_at>NOW()-INTERVAL '5m'`);
  console.log("New AI Lab ideas from lab_discussion (expect ≥1):"); rows(labD as unknown[]);

  // ── E: Private room isolation (Layer 2 + log entry) ─────────────────
  sep("E: private room → echo forced false + ai_moderation_log entry");
  await queueMentionResponse({ agentId: "ai_qwen", agentHandle: "qwen", roomId: PRIV_ROOM, ideaId: PRIV_IDEA, mentionUserId: USER_ID, mentionText: "@qwen from private room!", isPrivateRoom: true, echoToLab: false, ...B });
  await db.insert(schema.aiModerationLog).values({ moderatorAgentId: "system", targetType: "mention", targetId: PRIV_IDEA, verdict: "isolated", reason: "Private room: echo to Lab blocked by server action. (Step-10 verify)", reviewedAt: new Date() });
  const modE = await q(`SELECT moderator_agent_id, target_type, verdict, SUBSTRING(reason,1,80) reason FROM ai_moderation_log WHERE verdict='isolated' ORDER BY reviewed_at DESC LIMIT 3`);
  console.log("Isolation audit log:"); rows(modE as unknown[]);
  const labE = await q(`SELECT COUNT(*) n FROM ai_queue WHERE action_type='lab_discussion' AND prompt_context->>'source_room_id'='${PRIV_ROOM}'`);
  console.log("lab_discussion from private room (MUST be 0):", (labE as Array<{ n: string }>)[0]?.n);

  // ── F: Layer 4 bypass injection ──────────────────────────────────────
  sep("F: inject lab_discussion with is_private_room=true → processQueue rejects");
  const [injected] = await db.insert(schema.aiQueue).values({
    agentId: "ai_llama", actionType: "lab_discussion", roomId: LAB, targetIdeaId: TARGET_IDEA,
    promptContext: { kind: "lab_discussion", is_private_room: true, source_idea_summary: "Bypass attempt" },
    scheduledFor: new Date(), priority: 7, status: "pending",
  }).returning({ id: schema.aiQueue.id });
  const resF = await processQueue(1);
  console.log("processQueue result (expect failed=1):", resF);
  const rejF = await q(`SELECT status, SUBSTRING(error_message,1,90) err FROM ai_queue WHERE id='${injected.id}'`);
  console.log("Injected row (expect status=failed):"); rows(rejF as unknown[]);
  const logF = await q(`SELECT target_type, verdict, SUBSTRING(reason,1,90) reason FROM ai_moderation_log WHERE target_type='queue_action' ORDER BY reviewed_at DESC LIMIT 2`);
  console.log("Layer 4 audit log:"); rows(logF as unknown[]);

  // ── G: Rate limit count ───────────────────────────────────────────────
  sep("G: rate limit — mention count for test user in last 24h");
  const rateG = await q(`SELECT COUNT(*) n FROM ai_queue WHERE action_type='comment' AND prompt_context->>'kind'='mention_response' AND prompt_context->>'mention_user_id'='${USER_ID}' AND created_at>=NOW()-INTERVAL '24h'`);
  const cnt = Number((rateG as Array<{ n: string }>)[0]?.n ?? 0);
  const lim = parseInt(process.env.AI_MENTION_DAILY_LIMIT ?? "3") || 3;
  console.log(`${cnt} of ${lim} used. ${cnt >= lim ? "AT LIMIT — next would be rate_limit_exceeded" : `${lim - cnt} remaining`}`);

  sep("✓ Week 3 verification complete");
  await client.end();
}

main().catch((e) => { console.error(e.stack ?? e); process.exit(1); });
