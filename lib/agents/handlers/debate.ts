import { db } from "@/db";
import {
  aiQueue, ideaComments, ideas, aiUsage,
  debateTurns, debateQuestions, debates, debatePushbacks,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getDebateById, getDebateParticipants, getDebateTurns,
} from "../debate-helpers";
import { getAgent } from "../personas";
import { callAgent } from "../providers/index";
import { callGroq } from "../providers/groq";
import {
  buildDebateTurnPrompt,
  buildDebateArchivePrompt,
  buildRound2TurnPrompt,
  buildRound2ArchivePrompt,
  buildAILabDebateJudgePrompt,
  buildAILabDebateTurnPrompt,
  buildMultiRoundDebateTurnPrompt,
  buildDebateVerdictPrompt,
} from "../prompts";
import { stripThinkingTags } from "../response-cleaner";
import { parseJsonResponse } from "../json-helpers";
import type { AIQueue } from "@/db/schema";
import { upsertUsage } from "./shared";

// ─── DEBATE_TURN ──────────────────────────────────────────────────────────────
// Chains: debate_turn (slot 0) → debate_turn (slot 1) → debate_archive
// Handles both round 1 and round 2. round defaults to 1 for legacy queue items.
export async function executeDebateTurn(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string,
): Promise<void> {
  const ctx      = (item.promptContext as Record<string, unknown>) ?? {};
  const debateId = String(ctx.debateId ?? "");
  const slot     = Number(ctx.slot ?? 0);
  const round    = Number((ctx.round as number | undefined) ?? 1);

  if (!debateId) throw new Error("debate_turn: missing debateId in promptContext");

  const debate = await getDebateById(debateId);

  if (!debate || debate.status === "abandoned") {
    await db.update(aiQueue).set({ status: "cancelled" }).where(eq(aiQueue.id, item.id));
    return;
  }

  const participants  = await getDebateParticipants(debateId);
  // All turns sorted by createdAt — order is stable regardless of which agent ran
  const allTurns = (await getDebateTurns(debateId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const round1Turns = allTurns.filter(t => t.round === 1);
  const round2Turns = allTurns.filter(t => t.round === 2);

  let prompt: string;

  if (round >= 3) {
    // Multi-round: rounds 3+ use buildMultiRoundDebateTurnPrompt
    // Agent B (slot 1) needs Agent A's turn from this round to exist first
    const currentRoundTurns = allTurns.filter(t => t.round === round);
    if (slot === 1 && currentRoundTurns.length === 0) {
      await db.update(aiQueue)
        .set({ scheduledFor: new Date(Date.now() + 30_000) })
        .where(eq(aiQueue.id, item.id));
      return;
    }

    // Fetch pushbacks for context
    const { debatePushbacks: pushbacksTable } = await import("@/db/schema");
    const pushbacks = await db.query.debatePushbacks.findMany({
      where: eq(pushbacksTable.debateId, debateId),
    });

    // Find the most recent pushback targeting this agent or both
    const relevantPushback = pushbacks
      .filter(p => !p.agentId || p.agentId === agent.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const multiRoundPrompt = buildMultiRoundDebateTurnPrompt({
      debate,
      agent,
      allTurns: allTurns.map(t => ({
        agentId: t.agentId ?? "",
        content: t.content,
        round: t.round,
        slotIndex: 0, // will be determined by position in round
      })),
      round,
      pushbackText: relevantPushback?.text ?? undefined,
      pushbackTarget: relevantPushback?.agentId ?? undefined,
    });
    prompt = multiRoundPrompt.systemPrompt + "\n\n" + multiRoundPrompt.userPrompt;
  } else if (round === 2) {
    const round1AgentATurn = round1Turns[0];
    const round1AgentBTurn = round1Turns[1];
    if (!round1AgentATurn || !round1AgentBTurn) {
      throw new Error("debate_turn: round 2 requires both round 1 turns to exist");
    }

    // Agent B (round 2, slot 1) needs round 2 Agent A turn
    if (slot === 1 && !round2Turns[0]) {
      await db.update(aiQueue)
        .set({ scheduledFor: new Date(Date.now() + 30_000) })
        .where(eq(aiQueue.id, item.id));
      return;
    }

    const agentAAgent = getAgent(participants[0]?.agentId ?? "");
    const agentBAgent = getAgent(participants[1]?.agentId ?? "");
    prompt = buildRound2TurnPrompt({
      debate,
      agent,
      slot: slot as 0 | 1,
      round1AgentATurn,
      round1AgentBTurn,
      round2AgentATurn: round2Turns[0],
      agentAName: agentAAgent?.name ?? "Agent A",
      agentBName: agentBAgent?.name ?? "Agent B",
    });
  } else {
    // Round 1
    const isAgentB   = slot === 1;
    const agentATurn = isAgentB ? (round1Turns[0] ?? null) : null;

    // Defensive retry — Agent B fires but Agent A's turn not yet written
    if (isAgentB && !agentATurn) {
      await db.update(aiQueue)
        .set({ scheduledFor: new Date(Date.now() + 30_000) })
        .where(eq(aiQueue.id, item.id));
      return;
    }

    const [questionRow] = await db
      .select()
      .from(debateQuestions)
      .where(eq(debateQuestions.debateId, debateId))
      .limit(1);

    const agentAAgent = isAgentB ? getAgent(participants[0]?.agentId ?? "") : null;
    const agentAName  = agentAAgent?.name ?? null;

    prompt = buildDebateTurnPrompt({
      debate,
      agent,
      agentATurn,
      agentAName,
      question: questionRow ?? null,
    });
  }

  const response = await callAgent(agent, prompt, { maxTokens: 400 });
  const content  = response.trim();

  if (!content) throw new Error(`debate_turn: empty response from ${agent.handle}`);

  await db.insert(debateTurns).values({
    debateId,
    agentId:    agent.id,
    authorType: "agent",
    content,
    round,
  });

  await upsertUsage(agent.id, today, agent.provider, "quick_debate");

  if (slot === 0) {
    const agentBParticipant = participants[1];
    if (!agentBParticipant) throw new Error("debate_turn: no Agent B participant found");

    await db.insert(aiQueue).values({
      agentId:       agentBParticipant.agentId,
      actionType:    "debate_turn",
      promptContext: { debateId, slot: 1, round },
      priority:      1,
      scheduledFor:  new Date(),
      status:        "pending",
    });
  }

  if (slot === 1) {
    // Fetch debate to check maxRounds
    const currentDebate = await getDebateById(debateId);
    const maxRounds = currentDebate?.maxRounds ?? 3;

    if (round >= maxRounds) {
      // Max rounds reached — go to final verdict
      const archivistAgent = getAgent("ai_archivist");
      if (!archivistAgent) throw new Error("debate_turn: ai_archivist agent not found");

      await db.insert(aiQueue).values({
        agentId:       archivistAgent.id,
        actionType:    "debate_final_verdict",
        promptContext: { debateId },
        priority:      1,
        scheduledFor:  new Date(),
        status:        "pending",
      });
    } else {
      // More rounds possible — transition to awaiting_pushback
      await db.update(debates).set({
        status: "awaiting_pushback",
        updatedAt: new Date(),
      }).where(eq(debates.id, debateId));
    }
  }

  await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
}

// ─── DEBATE_ARCHIVE ───────────────────────────────────────────────────────────
// Round 1: generates crux summary, sets status=archived, shareToken.
// Round 2: generates verdict_reasoning + verdict JSON, preserves archivistSummary.
export async function executeDebateArchive(item: AIQueue): Promise<void> {
  const ctx      = (item.promptContext as Record<string, unknown>) ?? {};
  const debateId = String(ctx.debateId ?? "");
  const round    = Number((ctx.round as number | undefined) ?? 1);

  if (!debateId) throw new Error("debate_archive: missing debateId in promptContext");

  const debate = await getDebateById(debateId);

  if (!debate || debate.status === "abandoned") {
    await db.update(aiQueue).set({ status: "cancelled" }).where(eq(aiQueue.id, item.id));
    return;
  }

  // Idempotent guard — concurrent run protection
  if (debate.status === "archived" && round === 1) {
    await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
    return;
  }

  const participants = await getDebateParticipants(debateId);
  // Sort by createdAt — stable regardless of which agent ran (rate-limit swaps)
  const allTurns = (await getDebateTurns(debateId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Resolve display names: prefer participants table, fall back to whoever actually ran
  const agentAAgent = getAgent(participants[0]?.agentId ?? allTurns[0]?.agentId ?? "");
  const agentBAgent = getAgent(participants[1]?.agentId ?? allTurns[1]?.agentId ?? "");
  const agentAName  = agentAAgent?.name ?? "Agent A";
  const agentBName  = agentBAgent?.name ?? "Agent B";

  const today = new Date().toISOString().slice(0, 10);

  if (round === 2) {
    const round1Turns = allTurns.filter(t => t.round === 1);
    const round2Turns = allTurns.filter(t => t.round === 2);

    if (round1Turns.length < 2 || round2Turns.length < 2) {
      await db.update(aiQueue)
        .set({ scheduledFor: new Date(Date.now() + 30_000) })
        .where(eq(aiQueue.id, item.id));
      return;
    }

    const { systemPrompt, userPrompt } = buildRound2ArchivePrompt({
      debate,
      round1AgentATurn: round1Turns[0],
      round1AgentBTurn: round1Turns[1],
      round2AgentATurn: round2Turns[0],
      round2AgentBTurn: round2Turns[1],
      agentAName,
      agentBName,
    });

    const raw = await callGroq(
      "openai/gpt-oss-20b",
      systemPrompt,
      userPrompt,
      { temperature: 0.5, maxTokens: 400, jsonMode: true },
    );

    let parsed: { verdict_reasoning: string; verdict: string };
    try {
      parsed = parseJsonResponse(raw) as typeof parsed;
    } catch {
      throw new Error(`debate_archive round 2: failed to parse JSON from Archivist — ${raw.slice(0, 200)}`);
    }

    if (!parsed.verdict_reasoning || !parsed.verdict) {
      throw new Error("debate_archive round 2: missing verdict_reasoning or verdict in response");
    }

    await db.update(debates)
      .set({
        status:           "archived",
        verdictReasoning: parsed.verdict_reasoning.trim(),
        verdict:          parsed.verdict.trim(),
        updatedAt:        new Date(),
      })
      .where(eq(debates.id, debateId));

    await upsertUsage("ai_archivist", today, "groq");
    await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
    return;
  }

  // Round 1
  const agentATurn = allTurns[0];
  const agentBTurn = allTurns[1];

  if (!agentATurn || !agentBTurn) {
    await db.update(aiQueue)
      .set({ scheduledFor: new Date(Date.now() + 30_000) })
      .where(eq(aiQueue.id, item.id));
    return;
  }

  const { systemPrompt, userPrompt } = buildDebateArchivePrompt({
    debate,
    agentATurn,
    agentBTurn,
    agentAName,
    agentBName,
  });

  const summary = await callGroq(
    "openai/gpt-oss-20b",
    systemPrompt,
    userPrompt,
    { temperature: 0.5, maxTokens: 300 },
  );

  if (!summary.trim()) throw new Error("debate_archive: empty summary from gpt-oss-20b");

  await db.update(debates)
    .set({
      status:           "archived",
      archivistSummary: summary.trim(),
      shareToken:       crypto.randomUUID(),
      archivedAt:       new Date(),
      updatedAt:        new Date(),
    })
    .where(eq(debates.id, debateId));

  await upsertUsage("ai_archivist", today, "groq");
  await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
}

// ─── AI Lab "Debate of the Day" ───────────────────────────────────────
//
// Autonomous counterpart to Quick Debate: queued once daily by
// queueAILabDebateOfDay() for the day's most contested idea. No human
// submitted this, so there's no needs_clarification path — the Judge only
// picks the sharpest pairing and mode, then both agents post a tight,
// adversarial two-turn exchange as comments on the idea itself.

export async function executeAILabDebate(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  if (!item.targetIdeaId) throw new Error("ai_lab_debate action missing targetIdeaId");
  const c = (item.promptContext as { ideaTitle: string; ideaContent: string; theme: string }) ?? {};

  // ── Judge: pick agents + mode ────────────────────────────────────────
  const judgePrompt = buildAILabDebateJudgePrompt(c.ideaTitle, c.ideaContent, c.theme);
  const judgeRaw = await callGroq(agent.model, "You are a debate routing judge. Respond in valid JSON only. No markdown.", judgePrompt, {
    maxTokens: 300,
    jsonMode:  true,
  });
  const judgment = parseJsonResponse(judgeRaw) as {
    recommended_agents: string[];
    recommended_mode:   string;
    reasoning:           string;
  };

  const agentIds = Array.isArray(judgment.recommended_agents) ? judgment.recommended_agents : [];
  if (agentIds.length < 2) throw new Error("ai_lab_debate Judge did not return 2 agents");

  const agentA = getAgent(agentIds[0]);
  const agentB = getAgent(agentIds[1]);
  if (!agentA || !agentB) throw new Error(`ai_lab_debate Judge picked unknown agent(s): ${agentIds.join(", ")}`);

  const mode = judgment.recommended_mode ?? "brainstorm";

  // ── Turn A ────────────────────────────────────────────────────────────
  const promptA = buildAILabDebateTurnPrompt({
    ideaTitle: c.ideaTitle, ideaContent: c.ideaContent, theme: c.theme,
    mode, reasoning: judgment.reasoning ?? "",
    agent: agentA, agentATurn: null, agentAName: null,
  });
  const responseA = stripThinkingTags(await callAgent(agentA, promptA, { temperature: 0.8 }));
  const label = `**🎯 Debate of the Day** (${mode.replace("_", " ")}) — `;

  const [commentA] = await db
    .insert(ideaComments)
    .values({ ideaId: item.targetIdeaId, userId: agentA.id, content: label + responseA.trim(), parentId: null })
    .returning({ id: ideaComments.id });

  // ── Turn B — must name and contest Agent A's specific claim ──────────
  const promptB = buildAILabDebateTurnPrompt({
    ideaTitle: c.ideaTitle, ideaContent: c.ideaContent, theme: c.theme,
    mode, reasoning: judgment.reasoning ?? "",
    agent: agentB, agentATurn: { content: responseA.trim() }, agentAName: agentA.name,
  });
  const responseB = stripThinkingTags(await callAgent(agentB, promptB, { temperature: 0.8 }));

  const [commentB] = await db
    .insert(ideaComments)
    .values({
      ideaId: item.targetIdeaId, userId: agentB.id,
      content: label + responseB.trim(),
      parentId: commentA?.id ?? null,
    })
    .returning({ id: ideaComments.id });

  await db
    .update(ideas)
    .set({ totalComments: sql`${ideas.totalComments} + ${commentB ? 2 : 1}` })
    .where(eq(ideas.id, item.targetIdeaId));

  if (commentA) await db.update(aiQueue).set({ resultCommentId: commentA.id }).where(eq(aiQueue.id, item.id));

  console.log(`[ai-lab] Debate of the Day posted for idea ${item.targetIdeaId} (${agentA.handle} vs ${agentB.handle}, ${mode})`);

  // ── Increment usage (self-contained handler manages its own) ─────────
  const now = new Date();
  await db
    .insert(aiUsage)
    .values({ agentId: agent.id, date: today, requestCount: 1, lastRequestAt: now, lastProvider: agent.provider })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
      set: { requestCount: sql`${aiUsage.requestCount} + 1`, lastRequestAt: now, lastProvider: agent.provider },
    });
}

// ─── DEBATE FINAL VERDICT ────────────────────────────────────────────────────
// Generates a structured final verdict after all rounds are complete
// or when the user requests early verdict via POST /api/debates/[id]/verdict.

export async function executeDebateFinalVerdict(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const ctx      = (item.promptContext as Record<string, unknown>) ?? {};
  const debateId = String(ctx.debateId ?? "");

  if (!debateId) throw new Error("debate_final_verdict: missing debateId in promptContext");

  const debate = await getDebateById(debateId);

  if (!debate || debate.status === "abandoned") {
    await db.update(aiQueue).set({ status: "cancelled" }).where(eq(aiQueue.id, item.id));
    return;
  }

  // Load all turns across all rounds
  const rawTurns = (await getDebateTurns(debateId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Load pushbacks for context
  const pushbacks = await db.query.debatePushbacks.findMany({
    where: eq(debatePushbacks.debateId, debateId),
  });

  // Build verdict prompt
  const { systemPrompt, userPrompt } = buildDebateVerdictPrompt({
    debate,
    allTurns: rawTurns.map(t => ({
      agentId: t.agentId ?? "",
      content: t.content,
      round: t.round,
      slotIndex: 0,
    })),
    pushbacks: pushbacks.map(p => ({
      text: p.text,
      round: p.round,
      agentId: p.agentId,
    })),
  });

  // Call LLM for verdict
  const rawResponse = await callGroq(
    "openai/gpt-oss-20b",
    systemPrompt,
    userPrompt,
    { temperature: 0.3, maxTokens: 800, jsonMode: true }
  );

  let parsed: { verdict: string; score: number; winner_id: string; summary: string };
  try {
    parsed = JSON.parse(rawResponse.trim());
  } catch {
    throw new Error(`debate_final_verdict: failed to parse JSON — ${rawResponse.slice(0, 200)}`);
  }

  if (!parsed.verdict || !parsed.summary) {
    throw new Error("debate_final_verdict: missing verdict or summary in response");
  }

  // Resolve winner_id to a valid agent ID
  const VALID_IDS = ["ai_llama", "ai_gpt_oss", "ai_scout", "ai_maverick"];
  const winnerId = VALID_IDS.includes(parsed.winner_id) ? parsed.winner_id : null;

  // Store verdict and archive
  await db.update(debates).set({
    status:           "archived",
    verdictReasoning: parsed.verdict.trim(),
    verdict:          parsed.summary.trim(),
    winnerId,
    archivistSummary: parsed.summary.trim(),
    shareToken:       debate.shareToken ?? crypto.randomUUID(),
    archivedAt:       new Date(),
    updatedAt:        new Date(),
  }).where(eq(debates.id, debateId));

  await upsertUsage(agent.id, today, agent.provider, "quick_debate");

  console.log(`[ai-lab] Debate final verdict generated for ${debateId} (winner: ${winnerId ?? "unresolved"})`);
}
