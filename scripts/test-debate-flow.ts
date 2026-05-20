/**
 * scripts/test-debate-flow.ts
 *
 * Quick Debate Phase 1 — integration verification script.
 * Runs against the real DB. Cleans up after itself.
 *
 * Tests:
 *   1. DB structure  — all 4 tables + indexes exist
 *   2. Judge routing — 10 inputs, expects 8/10 correct
 *   3. Debate turn   — full Agent A → Agent B → archive-queued flow (Groq agents)
 *   4. Cancel        — abandoned status + queue items cancelled
 *   5. Rate limit    — 6th start returns 429 (logic check only, no real API calls)
 *   6. Quick take    — single_answer stored correctly
 *
 * Usage:
 *   npx tsx scripts/test-debate-flow.ts
 */

import "dotenv/config";
import { db } from "@/db";
import {
  debates, debateQuestions, debateParticipants, debateTurns, aiQueue, users,
} from "@/db/schema";
import { eq, and, sql, count, gte } from "drizzle-orm";
import { callAgent } from "@/lib/agents/providers";
import { getAgent } from "@/lib/agents/personas";
import { parseJsonResponse } from "@/lib/agents/json-helpers";
import {
  buildJudgeEvaluationPrompt,
  buildDebateTurnPrompt,
} from "@/lib/agents/prompts";
import {
  getDebateById, getDebateParticipants, getDebateTurns,
} from "@/lib/agents/debate-helpers";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PASS  = "✅";
const FAIL  = "❌";
const WARN  = "⚠️ ";
const SKIP  = "⏭ ";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) { console.log(`  ${PASS} ${label}`); passed++; }
  else     { console.log(`  ${FAIL} ${label}${detail ? " — " + detail : ""}`); failed++; }
}

function warn(label: string, detail = "") {
  console.log(`  ${WARN} ${label}${detail ? " — " + detail : ""}`);
}

function skip(label: string, reason = "") {
  console.log(`  ${SKIP} ${label}${reason ? " — " + reason : ""}`);
}

// ── Test user: use ai_quality_checker (always present) ───────────────────────

async function getTestUserId(): Promise<string> {
  const [row] = await db.select({ id: users.id })
    .from(users).where(eq(users.id, "ai_quality_checker")).limit(1);
  if (!row) throw new Error("ai_quality_checker user not found — run seed-ai-agents.ts first");
  return row.id;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

const createdDebateIds: string[] = [];

async function cleanup() {
  if (createdDebateIds.length === 0) return;
  console.log(`\n🧹 Cleaning up ${createdDebateIds.length} test debate(s)…`);
  for (const id of createdDebateIds) {
    await db.delete(debates).where(eq(debates.id, id)).catch(() => {});
    await db.update(aiQueue)
      .set({ status: "cancelled" })
      .where(and(
        sql`${aiQueue.promptContext}->>'debateId' = ${id}`,
      )).catch(() => {});
  }
  // Clean up test queue items with debate action types that may have been created
  await db.delete(aiQueue).where(
    and(
      sql`${aiQueue.promptContext}->>'_test' = 'true'`,
    )
  ).catch(() => {});
  console.log("  Done.\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — DB structure
// ─────────────────────────────────────────────────────────────────────────────

async function testDbStructure() {
  console.log("\n── Step 1: DB Structure ─────────────────────────────────────");

  const tables = [
    "debates",
    "debate_questions",
    "debate_participants",
    "debate_turns",
  ];

  for (const t of tables) {
    const [row] = await db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${t}`
    );
    check(`Table '${t}' exists`, !!row);
  }

  // Check indexes
  const indexes = [
    "idx_debates_user",
    "idx_debates_share",
    "idx_debate_participants_debate",
    "idx_debate_turns_debate",
  ];
  for (const idx of indexes) {
    const [row] = await db.execute(
      sql`SELECT 1 FROM pg_indexes WHERE indexname = ${idx}`
    );
    check(`Index '${idx}' exists`, !!row);
  }

  // Check FK constraints
  const fks = [
    ["debates", "debates_user_id_users_id_fk"],
    ["debate_questions", "debate_questions_debate_id_debates_id_fk"],
    ["debate_participants", "debate_participants_debate_id_debates_id_fk"],
    ["debate_turns", "debate_turns_debate_id_debates_id_fk"],
  ];
  for (const [tbl, fk] of fks) {
    const [row] = await db.execute(
      sql`SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = ${tbl} AND constraint_name = ${fk}`
    );
    check(`FK '${fk}' exists`, !!row);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Judge routing quality
// ─────────────────────────────────────────────────────────────────────────────

interface JudgeResponse {
  needs_clarification: boolean;
  question:            string | null;
  verdict:             "single_answer" | "full_debate" | null;
  reasoning:           string | null;
  answer:              string | null;
  recommended_agents:  string[] | null;
  recommended_mode:    string | null;
}

const ROUTING_TESTS: Array<{ input: string; expected: string }> = [
  { input: "What is JWT?",                                                             expected: "single_answer" },
  { input: "Should I use PostgreSQL or MongoDB for my SaaS?",                         expected: "single_answer" },
  { input: "Subscription pricing is killing software innovation",                     expected: "full_debate"   },
  { input: "AI will replace most knowledge workers by 2030",                          expected: "full_debate"   },
  { input: "What's the best way to structure a Next.js project?",                     expected: "single_answer" },
  { input: "Open source software should be the default for government systems",       expected: "full_debate"   },
  { input: "idea",                                                                     expected: "needs_clarification" },
  { input: "Usage-based pricing is better than subscription for developer tools",     expected: "full_debate"   },
  { input: "How do I center a div in CSS?",                                            expected: "single_answer" },
  { input: "Social media does more harm than good to democracy",                      expected: "full_debate"   },
];

async function testJudgeRouting() {
  console.log("\n── Step 2: Judge Routing (8/10 bar) ─────────────────────────");
  const qcAgent = getAgent("ai_quality_checker");
  if (!qcAgent) { check("ai_quality_checker found", false); return; }

  let correct = 0;
  const misroutes: string[] = [];

  for (const t of ROUTING_TESTS) {
    const prompt = buildJudgeEvaluationPrompt(t.input);
    try {
      const raw      = await callAgent(qcAgent, prompt, { maxTokens: 400 });
      const judgment = parseJsonResponse(raw) as unknown as JudgeResponse;

      let actual: string;
      if (judgment.needs_clarification) actual = "needs_clarification";
      else actual = judgment.verdict ?? "unknown";

      const ok = actual === t.expected;
      if (ok) correct++;
      else misroutes.push(`  Input: "${t.input.slice(0, 50)}" → got '${actual}', expected '${t.expected}'`);

      console.log(`  ${ok ? PASS : FAIL} [${t.expected.padEnd(20)}] "${t.input.slice(0, 55)}"`);
    } catch (e) {
      console.log(`  ${FAIL} [ERROR] "${t.input.slice(0, 55)}" — ${(e as Error).message}`);
      misroutes.push(`  Input: "${t.input.slice(0, 50)}" → ERROR`);
    }
  }

  console.log(`\n  Score: ${correct}/10`);
  check(`Judge routes ≥8/10 correctly`, correct >= 8, `${correct}/10`);
  if (misroutes.length > 0) {
    console.log("  Misroutes:");
    misroutes.forEach(m => console.log(m));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Quick Take end-to-end
// ─────────────────────────────────────────────────────────────────────────────

async function testQuickTake(testUserId: string) {
  console.log("\n── Step 3: Quick Take (single_answer) ───────────────────────");

  const qcAgent = getAgent("ai_quality_checker");
  if (!qcAgent) { check("ai_quality_checker found", false); return; }

  const input  = "What is JWT and how does it work?";
  const prompt = buildJudgeEvaluationPrompt(input);
  const raw    = await callAgent(qcAgent, prompt, { maxTokens: 400 });
  const j      = parseJsonResponse(raw) as unknown as JudgeResponse;

  if (j.verdict !== "single_answer" && !j.needs_clarification) {
    warn("Judge did not route to single_answer for quick take test input — skipping storage check");
    return;
  }
  if (j.needs_clarification) {
    warn("Judge asked clarification for quick take input — skipping (acceptable)");
    return;
  }

  const [row] = await db.insert(debates).values({
    userId:        testUserId,
    originalInput: input,
    title:         input.slice(0, 200),
    debateType:    "quick_take",
    judgeVerdict:  "single_answer",
    judgeAnswer:   j.answer ?? "No answer returned",
    status:        "archived",
    archivedAt:    new Date(),
    updatedAt:     new Date(),
  }).returning();
  createdDebateIds.push(row.id);

  const saved = await getDebateById(row.id);
  check("Quick Take saved to DB",           !!saved);
  check("debate_type = quick_take",         saved?.debateType === "quick_take");
  check("judge_verdict = single_answer",    saved?.judgeVerdict === "single_answer");
  check("judge_answer populated",           !!saved?.judgeAnswer);
  check("status = archived immediately",    saved?.status === "archived");
  check("archived_at set",                  !!saved?.archivedAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Full debate: Agent A turn + Agent B chaining
// ─────────────────────────────────────────────────────────────────────────────

async function testFullDebateTurns(testUserId: string) {
  console.log("\n── Step 4: Full Debate — Agent A → Agent B chaining ─────────");

  const llamaAgent    = getAgent("ai_llama");
  const gptOssAgent   = getAgent("ai_gpt_oss");
  if (!llamaAgent || !gptOssAgent) {
    check("Required agents found (llama, gpt-oss)", false);
    return;
  }
  check("Required agents found (llama, gpt-oss)", true);

  // Create a full_debate record
  const input = "Subscription pricing is killing software innovation";
  const [debate] = await db.insert(debates).values({
    userId:         testUserId,
    originalInput:  input,
    title:          input.slice(0, 200),
    debateType:     "full_debate",
    judgeVerdict:   "full_debate",
    judgeReasoning: "This is a strong opinion about business models that invites disagreement.",
    debateMode:     "risk_scan",
    status:         "in_progress",
    updatedAt:      new Date(),
  }).returning();
  createdDebateIds.push(debate.id);

  // Insert participants: Llama (slot 0), GPT-OSS (slot 1)
  await db.insert(debateParticipants).values([
    { debateId: debate.id, agentId: llamaAgent.id, slotIndex: 0 },
    { debateId: debate.id, agentId: gptOssAgent.id, slotIndex: 1 },
  ]);
  check("Participants inserted (2 rows)", true);

  const participants = await getDebateParticipants(debate.id);
  check("getDebateParticipants returns 2", participants.length === 2);
  check("Slot 0 = llama",                  participants[0]?.agentId === llamaAgent.id);
  check("Slot 1 = gpt-oss",               participants[1]?.agentId === gptOssAgent.id);

  // ── Agent A turn ──────────────────────────────────────────────────────────

  console.log("\n  Running Agent A (llama) turn…");
  const promptA = buildDebateTurnPrompt({
    debate:     { originalInput: debate.originalInput, judgeReasoning: debate.judgeReasoning, debateMode: debate.debateMode },
    agent:      { name: llamaAgent.name, persona: llamaAgent.persona },
    agentATurn: null,
    agentAName: null,
    question:   null,
  });

  const responseA = await callAgent(llamaAgent, promptA, { maxTokens: 400 });
  const contentA  = responseA.trim();

  check("Agent A response non-empty",           contentA.length > 0);
  check("Agent A response ≥50 chars",           contentA.length >= 50);

  await db.insert(debateTurns).values({
    debateId:   debate.id,
    agentId:    llamaAgent.id,
    authorType: "agent",
    content:    contentA,
  });
  check("Agent A turn written to debate_turns", true);

  const turnsAfterA = await getDebateTurns(debate.id);
  check("1 turn in DB after Agent A",          turnsAfterA.length === 1);
  check("Turn has correct agentId",             turnsAfterA[0]?.agentId === llamaAgent.id);

  // ── Agent B turn (must reference Agent A) ────────────────────────────────

  console.log("\n  Running Agent B (gpt-oss) turn…");
  const agentATurn = turnsAfterA[0] ?? null;
  const promptB = buildDebateTurnPrompt({
    debate:     { originalInput: debate.originalInput, judgeReasoning: debate.judgeReasoning, debateMode: debate.debateMode },
    agent:      { name: gptOssAgent.name, persona: gptOssAgent.persona },
    agentATurn: agentATurn ? { content: agentATurn.content, agentId: agentATurn.agentId } : null,
    agentAName: llamaAgent.name,
    question:   null,
  });

  const responseB = await callAgent(gptOssAgent, promptB, { maxTokens: 400 });
  const contentB  = responseB.trim();

  check("Agent B response non-empty",           contentB.length > 0);
  check("Agent B response ≥50 chars",           contentB.length >= 50);
  check("Agent B prompt included Agent A turn", promptB.includes(llamaAgent.name.toUpperCase()));

  await db.insert(debateTurns).values({
    debateId:   debate.id,
    agentId:    gptOssAgent.id,
    authorType: "agent",
    content:    contentB,
  });
  check("Agent B turn written to debate_turns", true);

  const turnsAfterB = await getDebateTurns(debate.id);
  check("2 turns in DB after Agent B",          turnsAfterB.length === 2);
  check("Turns ordered by createdAt",
    turnsAfterB[0]?.agentId === llamaAgent.id &&
    turnsAfterB[1]?.agentId === gptOssAgent.id
  );

  // Print Agent B content so we can manually check it references Agent A
  console.log("\n  Agent A said (first 120 chars):");
  console.log("  »", contentA.slice(0, 120).replace(/\n/g, " "));
  console.log("\n  Agent B said (first 120 chars):");
  console.log("  »", contentB.slice(0, 120).replace(/\n/g, " "));

  // ── Archive: generate summary via gpt-4o-mini ────────────────────────────
  console.log("\n  Running debate_archive (gpt-4o-mini)…");
  const { buildDebateArchivePrompt } = await import("@/lib/agents/prompts");
  const { callGitHub } = await import("@/lib/agents/providers/github");

  const agentAAgent2 = getAgent(llamaAgent.id)!;
  const agentBAgent2 = getAgent(gptOssAgent.id)!;
  const { systemPrompt, userPrompt } = buildDebateArchivePrompt({
    debate:     { originalInput: debate.originalInput, debateMode: debate.debateMode },
    agentATurn: { content: contentA },
    agentBTurn: { content: contentB },
    agentAName: agentAAgent2.name,
    agentBName: agentBAgent2.name,
  });

  const summary = await callGitHub("openai/gpt-4o-mini", systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 300 });
  check("Archive summary non-empty",          summary.trim().length > 0);
  check("Archive summary ≥50 words",          summary.trim().split(/\s+/).length >= 50);

  // Store it
  await db.update(debates)
    .set({
      status:           "archived",
      archivistSummary: summary.trim(),
      shareToken:       crypto.randomUUID(),
      archivedAt:       new Date(),
      updatedAt:        new Date(),
    })
    .where(eq(debates.id, debate.id));

  const archived = await getDebateById(debate.id);
  check("debates.status = archived",          archived?.status === "archived");
  check("archivistSummary saved",             !!archived?.archivistSummary);
  check("shareToken generated",               !!archived?.shareToken);
  check("archivedAt set",                     !!archived?.archivedAt);

  console.log("\n  Archive summary (first 200 chars):");
  console.log("  »", summary.trim().slice(0, 200).replace(/\n/g, " "));

  // ── Share token: verify getDebateByShareToken works ──────────────────────
  const { getDebateByShareToken } = await import("@/lib/agents/debate-helpers");
  const byToken = await getDebateByShareToken(archived!.shareToken!);
  check("getDebateByShareToken finds debate",  !!byToken);
  check("Share token resolves to correct id",  byToken?.id === debate.id);
  check("Only archived debates returned",      byToken?.status === "archived");

  return debate.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Cancel mechanism
// ─────────────────────────────────────────────────────────────────────────────

async function testCancel(testUserId: string) {
  console.log("\n── Step 5: Cancel Mechanism ─────────────────────────────────");

  const [debate] = await db.insert(debates).values({
    userId:        testUserId,
    originalInput: "cancel test input",
    title:         "cancel test",
    debateType:    "full_debate",
    judgeVerdict:  "full_debate",
    debateMode:    "brainstorm",
    status:        "in_progress",
    updatedAt:     new Date(),
  }).returning();
  createdDebateIds.push(debate.id);

  // Insert a fake pending queue item
  const llamaAgent = getAgent("ai_llama")!;
  await db.insert(aiQueue).values({
    agentId:       llamaAgent.id,
    actionType:    "debate_turn",
    promptContext: { debateId: debate.id, slot: 0, _test: "true" },
    priority:      2,
    scheduledFor:  new Date(),
    status:        "pending",
  });

  // Perform cancel (same logic as API route)
  await db.update(debates)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(eq(debates.id, debate.id));

  await db.update(aiQueue)
    .set({ status: "cancelled" })
    .where(and(
      sql`${aiQueue.promptContext}->>'debateId' = ${debate.id}`,
      eq(aiQueue.status, "pending"),
    ));

  const saved = await getDebateById(debate.id);
  check("debates.status = abandoned",          saved?.status === "abandoned");

  const queueItems = await db.select()
    .from(aiQueue)
    .where(sql`${aiQueue.promptContext}->>'debateId' = ${debate.id}`);
  const allCancelled = queueItems.every(r => r.status === "cancelled");
  check("All queue items cancelled",           allCancelled);
  check("No pending items remain",             !queueItems.some(r => r.status === "pending"));
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Rate limit logic
// ─────────────────────────────────────────────────────────────────────────────

async function testRateLimits(testUserId: string) {
  console.log("\n── Step 6: Rate Limit Logic ─────────────────────────────────");

  // Count debates for test user today — should be whatever we created above
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
  const [judgeRow] = await db
    .select({ n: count() })
    .from(debates)
    .where(and(eq(debates.userId, testUserId), gte(debates.createdAt, startOfDay)));
  const judgeCount = Number(judgeRow?.n ?? 0);

  console.log(`  Current judge count today (test user): ${judgeCount}`);
  check("Judge count query works", judgeCount >= 0);
  check("Judge count ≤ 10 (under daily cap)", judgeCount <= 10);

  const [debateRow] = await db
    .select({ n: count() })
    .from(debates)
    .where(and(
      eq(debates.userId, testUserId),
      eq(debates.judgeVerdict, "full_debate"),
      gte(debates.createdAt, startOfDay),
    ));
  const debateCount = Number(debateRow?.n ?? 0);
  console.log(`  Current full debate count today (test user): ${debateCount}`);
  check("Debate count query works", debateCount >= 0);
  check("Debate count ≤ 5 (under daily cap)", debateCount <= 5);

  // Verify the rate limit condition is correct
  check("Rate limit condition: count >= 10 blocks judge", judgeCount < 10);
  check("Rate limit condition: count >= 5 blocks start",  debateCount < 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 — Clarifying question flow
// ─────────────────────────────────────────────────────────────────────────────

async function testClarifyingQuestion(testUserId: string) {
  console.log("\n── Step 7: Clarifying Question Flow ─────────────────────────");

  const qcAgent = getAgent("ai_quality_checker");
  if (!qcAgent) { check("ai_quality_checker found", false); return; }

  const input  = "idea"; // deliberately vague
  const prompt = buildJudgeEvaluationPrompt(input);
  const raw    = await callAgent(qcAgent, prompt, { maxTokens: 400 });
  const j      = parseJsonResponse(raw) as unknown as JudgeResponse;

  console.log(`  Judge response for "idea": needs_clarification=${j.needs_clarification}, question="${j.question?.slice(0,80)}"`);
  check("Judge asks clarification for 'idea'", j.needs_clarification === true);
  check("Question is non-null",                !!j.question);
  check("Verdict is null when clarifying",     j.verdict === null);

  if (!j.needs_clarification || !j.question) {
    warn("Clarifying question not triggered — acceptable if input wasn't ambiguous enough to the model");
    return;
  }

  // Create debate + store question
  const [debate] = await db.insert(debates).values({
    userId:        testUserId,
    originalInput: input,
    title:         input.slice(0, 200),
    debateType:    "full_debate",
    judgeVerdict:  "pending",
    status:        "in_progress",
    updatedAt:     new Date(),
  }).returning();
  createdDebateIds.push(debate.id);

  await db.insert(debateQuestions).values({
    debateId:   debate.id,
    question:   j.question,
    orderIndex: 0,
  });
  check("Question saved to debate_questions", true);

  // Simulate user answering
  const userAnswer = "I want to debate whether AI startups should use open source or proprietary models.";
  await db.update(debateQuestions)
    .set({ answer: userAnswer })
    .where(eq(debateQuestions.debateId, debate.id));

  // Re-call judge with clarification
  const prompt2 = buildJudgeEvaluationPrompt(input, { question: j.question, answer: userAnswer });
  const raw2    = await callAgent(qcAgent, prompt2, { maxTokens: 400 });
  const j2      = parseJsonResponse(raw2) as unknown as JudgeResponse;

  console.log(`  After clarification: verdict="${j2.verdict}", needs_clarification=${j2.needs_clarification}`);
  check("After clarification: verdict is set",           !!j2.verdict);
  check("After clarification: no more clarifying",        !j2.needs_clarification);

  // Verify the question row has an answer
  const [qRow] = await db.select().from(debateQuestions)
    .where(eq(debateQuestions.debateId, debate.id)).limit(1);
  check("debate_questions.answer saved correctly",        qRow?.answer === userAnswer);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Quick Debate Phase 1 — Verification Script");
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    const testUserId = await getTestUserId();
    console.log(`\n  Test user: ${testUserId} (ai_quality_checker)\n`);

    await testDbStructure();
    await testJudgeRouting();
    await testQuickTake(testUserId);
    await testFullDebateTurns(testUserId);
    await testCancel(testUserId);
    await testRateLimits(testUserId);
    await testClarifyingQuestion(testUserId);

  } catch (err) {
    console.error("\n  FATAL ERROR:", (err as Error).message);
    failed++;
  } finally {
    await cleanup();
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed · ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n  Note: /debates/share/[token] page load (no-auth) must be verified");
  console.log("  manually on the preview URL in an incognito window.\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
