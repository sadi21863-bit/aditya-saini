import { db } from "@/db";
import {
  quickDebates, ideas, ideaComments, aiQueue,
} from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { getAgent } from "../personas";
import { callAgent } from "../providers/index";
import { stripThinkingTags } from "../response-cleaner";
import type { AIQueue } from "@/db/schema";
import { upsertUsage } from "./shared";

// MAX_ARCHIVE_RETRIES: number of times the archive job reschedules before giving up
const MAX_ARCHIVE_RETRIES = 3;

export async function executeQuickDebateSeed(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const ctx = (item.promptContext as Record<string, unknown>) ?? {};
  const debateId = String(ctx.debateId ?? "");
  const ideaId   = String(ctx.ideaId   ?? "");

  if (!debateId || !ideaId) throw new Error("quick_debate_seed: missing debateId or ideaId in promptContext");

  try {
    await db.update(quickDebates)
      .set({ status: "seeding" })
      .where(eq(quickDebates.id, debateId));

    // Fetch the idea
    const [idea] = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);
    if (!idea) throw new Error(`quick_debate_seed: idea ${ideaId} not found`);

    // Build prompt for Llama
    const prompt = `A user on IdeaConnect submitted this idea for debate:

"${idea.title}"

${idea.content ?? ""}

Write a substantive response (100-150 words) engaging with this idea from your perspective as ${agent.handle}.
Apply your persona fully — challenge if you disagree, support if you agree but with specific reasoning.
Do NOT start with a sycophantic opener. Lead with substance.`;

    const llamaResponse = await callAgent(agent, prompt, { maxTokens: 300 });
    const llamaContent  = stripThinkingTags(llamaResponse).trim();

    if (!llamaContent) throw new Error("quick_debate_seed: empty response from Llama");

    // Insert Llama's reply
    const [llamaComment] = await db
      .insert(ideaComments)
      .values({ ideaId, userId: agent.id, content: llamaContent })
      .returning({ id: ideaComments.id });

    // Usage upsert for Llama
    await upsertUsage(agent.id, today, agent.provider, "quick_debate");

    const gptOssAgent = getAgent("ai_gpt_oss");
    const archivist   = getAgent("ai_archivist");
    if (!gptOssAgent || !archivist) throw new Error("quick_debate_seed: required agents not found");

    // Queue GPT-OSS reply
    await db.insert(aiQueue).values({
      agentId:      gptOssAgent.id,
      actionType:   "quick_debate_reply",
      roomId:       item.roomId,
      targetIdeaId: ideaId,
      promptContext: {
        debateId,
        ideaId,
        priorCommentId: llamaComment?.id ?? "",
        priorAgentHandle: agent.handle,
        priorContent: llamaContent.slice(0, 300),
      },
      scheduledFor: new Date(),
      priority:     1,
      status:       "pending",
    });

    // Queue archive (60s later) — the archive handler gates on ≥2 replies
    await db.insert(aiQueue).values({
      agentId:      archivist.id,
      actionType:   "quick_debate_archive",
      roomId:       item.roomId,
      targetIdeaId: ideaId,
      promptContext: { debateId, ideaId, retryCount: 0 },
      scheduledFor: new Date(Date.now() + 60_000),
      priority:     1,
      status:       "pending",
    });

    await db.update(quickDebates)
      .set({ status: "debating" })
      .where(eq(quickDebates.id, debateId));

  } catch (err) {
    await db.update(quickDebates)
      .set({ status: "failed", errorMessage: (err as Error).message })
      .where(eq(quickDebates.id, debateId));
    throw err;
  }
}

export async function executeQuickDebateReply(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const ctx = (item.promptContext as Record<string, unknown>) ?? {};
  const debateId        = String(ctx.debateId        ?? "");
  const ideaId          = String(ctx.ideaId          ?? "");
  const priorContent    = String(ctx.priorContent    ?? "");
  const priorHandle     = String(ctx.priorAgentHandle ?? "llama");

  if (!debateId || !ideaId) throw new Error("quick_debate_reply: missing debateId or ideaId");

  try {
    const [idea] = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);
    if (!idea) throw new Error(`quick_debate_reply: idea ${ideaId} not found`);

    const prompt = `You're debating this idea on IdeaConnect:

IDEA: "${idea.title}"
${idea.content ?? ""}

@${priorHandle} just argued:
"${priorContent}"

Respond to @${priorHandle}'s take (under 150 words). Either push back with your own angle or extend their argument in a direction they missed.
No sycophantic opener. Start with your substantive response.`;

    const response = await callAgent(agent, prompt, { maxTokens: 300 });
    const content  = stripThinkingTags(response).trim();

    if (!content) throw new Error("quick_debate_reply: empty response from GPT-OSS");

    await db
      .insert(ideaComments)
      .values({ ideaId, userId: agent.id, content });

    await upsertUsage(agent.id, today, agent.provider, "quick_debate");

  } catch (err) {
    await db.update(quickDebates)
      .set({ status: "failed", errorMessage: (err as Error).message })
      .where(eq(quickDebates.id, debateId));
    throw err;
  }
}

export async function executeQuickDebateArchive(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const ctx        = (item.promptContext as Record<string, unknown>) ?? {};
  const debateId   = String(ctx.debateId   ?? "");
  const ideaId     = String(ctx.ideaId     ?? "");
  const retryCount = Number(ctx.retryCount ?? 0);

  if (!debateId || !ideaId) throw new Error("quick_debate_archive: missing debateId or ideaId");

  // Gate: both agent replies must exist before archiving
  const commentRows = await db
    .select({ userId: ideaComments.userId, content: ideaComments.content })
    .from(ideaComments)
    .where(eq(ideaComments.ideaId, ideaId))
    .orderBy(asc(ideaComments.createdAt));

  if (commentRows.length < 2) {
    if (retryCount >= MAX_ARCHIVE_RETRIES) {
      await db.update(quickDebates)
        .set({ status: "failed", errorMessage: `Archive gate: only ${commentRows.length} comment(s) after ${MAX_ARCHIVE_RETRIES} retries` })
        .where(eq(quickDebates.id, debateId));
      return;
    }

    // Reschedule — increment retryCount, check again in 30s
    await db.insert(aiQueue).values({
      agentId:      agent.id,
      actionType:   "quick_debate_archive",
      roomId:       item.roomId,
      targetIdeaId: ideaId,
      promptContext: { debateId, ideaId, retryCount: retryCount + 1 },
      scheduledFor: new Date(Date.now() + 30_000),
      priority:     1,
      status:       "pending",
    });

    console.log(`[executor] quick_debate_archive: only ${commentRows.length} comment(s) for debate ${debateId}, rescheduling (retry ${retryCount + 1}/${MAX_ARCHIVE_RETRIES})`);
    return;
  }

  try {
    await db.update(quickDebates)
      .set({ status: "archiving" })
      .where(eq(quickDebates.id, debateId));

    const [idea] = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);
    if (!idea) throw new Error(`quick_debate_archive: idea ${ideaId} not found`);

    const threadText = commentRows
      .map((r) => `@${(r.userId ?? "unknown").replace(/^ai_/, "").replace(/_/g, "-")}: ${r.content}`)
      .join("\n\n---\n\n");

    const prompt = `Summarize this AI debate as a short narrative archive (200-350 words).

DEBATE TOPIC: "${idea.title}"

IDEA:
${idea.content ?? ""}

DEBATE:
${threadText}

Write analytical narrative prose. Cover:
- The core positions each agent staked
- The sharpest moment of disagreement
- Whether any resolution was reached or what remains open

Be direct. No generic praise language. Name agents by handle.`;

    const rawResponse = await callAgent(agent, prompt, { temperature: 0.6, maxTokens: 600 });
    const narrativeArc = stripThinkingTags(rawResponse).trim();

    if (!narrativeArc) throw new Error("quick_debate_archive: empty narrative from Archivist");

    await db.update(quickDebates)
      .set({ status: "complete", narrativeArc, completedAt: new Date() })
      .where(eq(quickDebates.id, debateId));

    await upsertUsage(agent.id, today, agent.provider, "quick_debate");

  } catch (err) {
    await db.update(quickDebates)
      .set({ status: "failed", errorMessage: (err as Error).message })
      .where(eq(quickDebates.id, debateId));
    throw err;
  }
}
