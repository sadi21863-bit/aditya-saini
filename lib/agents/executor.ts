/**
 * lib/agents/executor.ts
 *
 * Reads from ai_queue and executes pending actions.
 * Called by the /api/cron/agents/tick endpoint every 5 minutes.
 *
 * Concurrency safety: uses FOR UPDATE SKIP LOCKED inside a short transaction
 * to atomically claim rows. Two concurrent workers will never process the
 * same row — each worker skips rows that are already locked by another.
 */

import { db } from "@/db";
import {
  aiQueue, aiUsage, ideas, ideaComments,
  aiThemes, aiModerationLog, aiLabArchives,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getAgent } from "./personas";
import { callAgent } from "./providers/index";
import { buildPrompt } from "./prompts";
import { stripThinkingTags } from "./response-cleaner";
import { parseJsonResponse } from "./json-helpers";
import type { AIQueue } from "@/db/schema";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID!;

/** Minimum text length accepted for ideas and comments. */
const MIN_CONTENT_LENGTH = 50;

// ─── Public entry point ───────────────────────────────────────────────

export async function processQueue(
  limit = 5
): Promise<{ processed: number; failed: number }> {
  // Step 1: Atomically claim pending rows.
  // FOR UPDATE SKIP LOCKED ensures no two concurrent workers process the same row.
  const claimedIds = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      SELECT id FROM ai_queue
      WHERE  status       = 'pending'
        AND  scheduled_for <= now()
      ORDER  BY priority ASC, scheduled_for ASC
      LIMIT  ${limit}
      FOR UPDATE SKIP LOCKED
    `);

    const ids = (rows as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return [];

    // Mark as in_progress while still in the same transaction
    await tx
      .update(aiQueue)
      .set({ status: "in_progress" })
      .where(inArray(aiQueue.id, ids));

    return ids;
  });

  if (claimedIds.length === 0) return { processed: 0, failed: 0 };

  // Step 2: Fetch full rows for claimed IDs
  const items = await db
    .select()
    .from(aiQueue)
    .where(inArray(aiQueue.id, claimedIds));

  let processed = 0;
  let failed    = 0;

  for (const item of items) {
    try {
      await executeItem(item);
      await db
        .update(aiQueue)
        .set({ status: "completed", executedAt: new Date() })
        .where(eq(aiQueue.id, item.id));
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status  = message.startsWith("rate_limited") ? "rate_limited" : "failed";
      await db
        .update(aiQueue)
        .set({ status, errorMessage: message, executedAt: new Date() })
        .where(eq(aiQueue.id, item.id));
      failed++;
    }
  }

  return { processed, failed };
}

// ─── Per-item execution ───────────────────────────────────────────────

async function executeItem(item: AIQueue): Promise<void> {
  const agent = getAgent(item.agentId);
  if (!agent) throw new Error(`Agent not found: ${item.agentId}`);

  // Rate limit check — throw with "rate_limited:" prefix so outer catch
  // can distinguish it from a real failure and set the correct status
  const today = new Date().toISOString().slice(0, 10);
  const [usage] = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.agentId, agent.id), eq(aiUsage.date, today)));

  if (usage && usage.requestCount >= agent.dailyLimit) {
    throw new Error(`rate_limited: ${agent.handle} has reached daily limit (${agent.dailyLimit})`);
  }

  // Build prompt and call LLM.
  // jsonMode: true enables response_format: { type: "json_object" } on Groq for
  // models that support it (Llama). Ignored for models that don't (Qwen3, GPT-OSS).
  const JSON_ACTIONS = new Set(["theme_select", "post_idea", "quality_review"]);
  const prompt      = buildPrompt(item);
  const rawResponse = await callAgent(agent, prompt, {
    jsonMode: JSON_ACTIONS.has(item.actionType),
  });

  // Defense-in-depth: strip thinking tags even though callAgent already does it
  const response = stripThinkingTags(rawResponse);

  if (!response.trim()) {
    throw new Error("Empty response after cleanup");
  }

  // Dispatch to the appropriate writer
  switch (item.actionType) {
    case "theme_select":   await writeThemeSelect(agent.id, item, response); break;
    case "post_idea":      await writePostIdea(agent.id, item, response);    break;
    case "comment":        await writeComment(agent.id, item, response);     break;
    case "quality_review": await writeQualityReview(agent.id, item, response); break;
    case "archive_day":    await writeArchiveDay(item, response);            break;
    default:
      throw new Error(`Unknown action type: ${item.actionType}`);
  }

  // Upsert usage record — increment request_count for (agent, date)
  await db
    .insert(aiUsage)
    .values({
      agentId:       agent.id,
      date:          today,
      requestCount:  1,
      lastRequestAt: new Date(),
      lastProvider:  agent.provider,
    })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      set: {
        requestCount:  sql`${aiUsage.requestCount} + 1`,
        lastRequestAt: new Date(),
        lastProvider:  agent.provider,
      },
    });
}

// ─── Writers ──────────────────────────────────────────────────────────

async function writeThemeSelect(
  agentId: string,
  item:    AIQueue,
  response: string
): Promise<void> {
  let parsed: { theme: string; rationale?: string; suggested_angles?: string[] };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch (e) {
    throw new Error(`Invalid JSON from Theme Setter: ${(e as Error).message}`);
  }
  if (!parsed.theme?.trim()) {
    throw new Error("Empty response after cleanup");
  }

  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(aiThemes)
    .values({
      date:          today,
      theme:         parsed.theme.trim(),
      rationale:     parsed.rationale   ?? null,
      researchNotes: parsed.suggested_angles
        ? { suggested_angles: parsed.suggested_angles }
        : null,
      setByAgentId:  agentId,
    })
    .onConflictDoUpdate({
      target: aiThemes.date,
      set: {
        theme:         parsed.theme.trim(),
        rationale:     parsed.rationale ?? null,
        researchNotes: parsed.suggested_angles
          ? { suggested_angles: parsed.suggested_angles }
          : null,
      },
    });
}

async function writePostIdea(
  agentId: string,
  item:    AIQueue,
  response: string
): Promise<void> {
  let parsed: { title?: string; pitch?: string; content?: string };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch (e) {
    throw new Error(`Invalid JSON from idea post: ${(e as Error).message}`);
  }

  const content = (parsed.content ?? "").trim();
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new Error("Empty response after cleanup");
  }

  const [newIdea] = await db
    .insert(ideas)
    .values({
      userId:      agentId,
      roomId:      item.roomId ?? AI_LAB_ROOM_ID,
      title:       (parsed.title ?? "Untitled").slice(0, 200),
      context:     parsed.pitch ?? null,
      content,
      status:      "published",
      feedVisible: true,
    })
    .returning({ id: ideas.id });

  if (newIdea) {
    await db
      .update(aiQueue)
      .set({ resultIdeaId: newIdea.id })
      .where(eq(aiQueue.id, item.id));
  }
}

async function writeComment(
  agentId: string,
  item:    AIQueue,
  response: string
): Promise<void> {
  const content = response.trim();
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new Error("Empty response after cleanup");
  }
  if (!item.targetIdeaId) {
    throw new Error("comment action is missing targetIdeaId");
  }

  const [newComment] = await db
    .insert(ideaComments)
    .values({ ideaId: item.targetIdeaId, userId: agentId, content })
    .returning({ id: ideaComments.id });

  if (newComment) {
    await db
      .update(aiQueue)
      .set({ resultCommentId: newComment.id })
      .where(eq(aiQueue.id, item.id));
  }
}

async function writeQualityReview(
  agentId: string,
  item:    AIQueue,
  response: string
): Promise<void> {
  let parsed: { verdict: string; reason?: string; improvement_note?: string };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch (e) {
    throw new Error(`Invalid JSON from Quality Checker: ${(e as Error).message}`);
  }

  const c          = (item.promptContext as Record<string, unknown>) ?? {};
  const targetType = String(c.targetType ?? "idea");
  const targetId   = String(c.targetId   ?? item.targetIdeaId ?? "");

  await db.insert(aiModerationLog).values({
    moderatorAgentId: agentId,
    targetType,
    targetId,
    verdict:    parsed.verdict,
    reason:     parsed.reason ?? null,
    reviewedAt: new Date(),
  });

  if (parsed.verdict === "retire") {
    if (targetType === "idea" && item.targetIdeaId) {
      await db
        .update(ideas)
        .set({
          retiredByModerator: true,
          retiredReason:      parsed.reason ?? null,
          retiredAt:          new Date(),
        })
        .where(eq(ideas.id, item.targetIdeaId));
    } else if (targetType === "comment" && item.targetCommentId) {
      await db
        .update(ideaComments)
        .set({ retiredByModerator: true, retiredReason: parsed.reason ?? null })
        .where(eq(ideaComments.id, item.targetCommentId));
    }
  }
}

async function writeArchiveDay(
  item:    AIQueue,
  response: string
): Promise<void> {
  // Archives can be shorter than ideas/comments — only the strict empty check applies
  if (!response.trim()) {
    throw new Error("Empty response after cleanup");
  }

  const c     = (item.promptContext as Record<string, unknown>) ?? {};
  const date  = String(c.date  ?? new Date().toISOString().slice(0, 10));
  const theme = String(c.theme ?? "");

  await db
    .insert(aiLabArchives)
    .values({ date, theme, summaryMarkdown: response, generatedAt: new Date() })
    .onConflictDoUpdate({
      target: aiLabArchives.date,
      set: { summaryMarkdown: response, generatedAt: new Date() },
    });
}
