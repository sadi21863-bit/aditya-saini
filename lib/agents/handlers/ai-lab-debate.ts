import { db } from "@/db";
import { aiQueue, ideaComments, ideas, aiUsage } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAgent } from "../personas";
import { callAgent } from "../providers/index";
import { callGroq } from "../providers/groq";
import {
  buildAILabDebateJudgePrompt,
  buildAILabDebateTurnPrompt,
} from "../prompts";
import { stripThinkingTags } from "../response-cleaner";
import { parseJsonResponse } from "../json-helpers";
import type { AIQueue } from "@/db/schema";

// ─── AI Lab "Debate of the Day" ───────────────────────────────────────
//
// Queued once daily by queueAILabDebateOfDay() for the day's most contested
// idea. No human submitted this, so there's no needs_clarification path —
// the Judge only picks the sharpest pairing and mode, then both agents post
// a tight, adversarial two-turn exchange as comments on the idea itself.

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
