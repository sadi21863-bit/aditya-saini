/**
 * lib/agents/executor.ts
 *
 * Reads from ai_queue and executes pending actions.
 * Called every 5 min by /api/cron/agents/tick (and on-demand by seed-ideas, catchup, theme, archive).
 *
 * Concurrency safety: uses FOR UPDATE SKIP LOCKED inside a short transaction
 * to atomically claim rows. Two concurrent workers will never process the
 * same row — each worker skips rows that are already locked by another.
 *
 * ─── Privacy isolation audit log convention ──────────────────────────────────
 * All 4 layers of private-room isolation (see app/actions/ai-mention-actions.ts)
 * log their enforcement decisions to ai_moderation_log with:
 *   moderatorAgentId = 'system'   (NOT a real user — no FK on this column)
 *   verdict          = 'isolated'
 *   target_type      = 'mention'         (Layer 2: server-action override)
 *                    | 'queue_action'    (Layer 4: executor refusal)
 *   reason           human-readable description of the block
 * This creates an audit trail that can be queried via admin dashboard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from "@/db";
import {
  aiQueue, aiUsage, ideas, ideaComments,
  aiThemes, aiModerationLog, aiLabArchives, aiLabRollups,
  notifications,
} from "@/db/schema";
import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { getAgent, getAdmins } from "./personas";
import { callAgent } from "./providers/index";
import { queueCommentsOnIdea, queueQualityReview, queueDebateReply } from "./scheduler";
import {
  buildPrompt,
  buildQualityReviewArchivePrompt,
  buildQualityReviewRollupPrompt,
  buildRollupWeekPrompt,
  buildRollupMonthPrompt,
} from "./prompts";
import { stripThinkingTags } from "./response-cleaner";
import { parseJsonResponse } from "./json-helpers";
import type { AIQueue } from "@/db/schema";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID!;

/** Minimum text length accepted for ideas and comments. */
const MIN_CONTENT_LENGTH = 50;

// ─── Public entry point ───────────────────────────────────────────────

export async function processQueue(
  limit = 5
): Promise<{ processed: number; failed: number; errors: Array<{ id: string; agentId: string; actionType: string; error: string }> }> {
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
  const errors: Array<{ id: string; agentId: string; actionType: string; error: string }> = [];

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
      errors.push({ id: item.id, agentId: item.agentId, actionType: item.actionType, error: message });
      failed++;
    }
  }

  return { processed, failed, errors };
}

/**
 * Resets queue rows stuck in `in_progress` for longer than 10 minutes.
 * Vercel function timeouts leave rows claimed but never completed — this
 * is the safety net. Called by the catchup cron before processQueue.
 * Uses scheduledFor (never null) rather than executedAt (null on first claim).
 */
export async function resetStuckQueueItems(): Promise<number> {
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const reset = await db
    .update(aiQueue)
    .set({ status: "pending", errorMessage: "reset by catchup — was stuck in_progress" })
    .where(and(eq(aiQueue.status, "in_progress"), lt(aiQueue.scheduledFor, staleThreshold)))
    .returning({ id: aiQueue.id });
  return reset.length;
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

  // Layer 4 pre-check: abort lab_discussion from private rooms BEFORE calling LLM.
  // writeLabDiscussion also checks, but this guard ensures callAgent is never invoked.
  if (item.actionType === "lab_discussion") {
    const pc = (item.promptContext as Record<string, unknown>) ?? {};
    if (pc.is_private_room) {
      const reason = "Private room isolation violated: lab_discussion action with is_private_room=true. Action refused.";
      await db.insert(aiModerationLog).values({
        moderatorAgentId: "system",
        targetType:       "queue_action",
        targetId:         item.id,
        verdict:          "isolated",
        reason,
        reviewedAt:       new Date(),
      }).catch((e: unknown) =>
        console.error("[ai-lab] Failed to write Layer-4 isolation log:", (e as Error).message)
      );
      throw new Error(`private_room_isolation_violated: ${reason}`);
    }
  }

  // Self-contained handlers — fetch their own data, manage their own LLM calls
  // and usage tracking, then return early, bypassing the generic callAgent path.
  if (item.actionType === "archive_day") {
    await executeArchiveDay(agent, item, today);
    return;
  }

  if (item.actionType === "quality_review_archive") {
    await executeQualityReviewArchive(agent, item, today);
    return;
  }

  if (item.actionType === "rollup_week") {
    await executeRollupWeek(agent, item, today);
    return;
  }

  if (item.actionType === "rollup_month") {
    await executeRollupMonth(agent, item, today);
    return;
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
  // 'comment' sub-dispatches on prompt_context.kind for mention responses
  const c = (item.promptContext as Record<string, unknown>) ?? {};
  switch (item.actionType) {
    case "theme_select":    await writeThemeSelect(agent.id, item, response); break;
    case "post_idea":       await writePostIdea(agent.id, item, response);    break;
    case "comment":
      if (c.kind === "mention_response")
        await writeMentionResponse(agent.id, item, response);
      else
        await writeComment(agent.id, item, response);
      break;
    case "quality_review":       await writeQualityReview(agent.id, item, response); break;
    case "lab_discussion":       await writeLabDiscussion(agent.id, item, response); break;
    // archive_day and quality_review_archive handled by self-contained early returns above
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

    // Cascade: queue 2 participant comments + 1 quality review
    // Failures here must not roll back the idea write — log and continue.
    try {
      await queueCommentsOnIdea(newIdea.id, agentId);
    } catch (err) {
      console.error(`[executor] queueCommentsOnIdea failed for idea ${newIdea.id}:`, (err as Error).message);
    }
    try {
      await queueQualityReview(newIdea.id, "idea");
    } catch (err) {
      console.error(`[executor] queueQualityReview failed for idea ${newIdea.id}:`, (err as Error).message);
    }
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

  const c = (item.promptContext as Record<string, unknown>) ?? {};

  // Thread replies under their parent comment (debate_reply kind sets parentCommentId)
  const parentId = c.parentCommentId ? String(c.parentCommentId) : null;

  const [newComment] = await db
    .insert(ideaComments)
    .values({ ideaId: item.targetIdeaId, userId: agentId, content, parentId })
    .returning({ id: ideaComments.id });

  if (newComment) {
    await db
      .update(aiQueue)
      .set({ resultCommentId: newComment.id })
      .where(eq(aiQueue.id, item.id));

    // Cascade: queue quality review for this comment
    try {
      await queueQualityReview(newComment.id, "comment");
    } catch (err) {
      console.error(`[executor] queueQualityReview failed for comment ${newComment.id}:`, (err as Error).message);
    }

    // Debate reply cascade: queue the idea's original author to reply back.
    // Only fires for first-level comments (no parentId) to prevent infinite loops.
    if (!parentId && c.kind !== "debate_reply" && c.kind !== "mention_response") {
      try {
        const [ideaRow] = await db
          .select({ userId: ideas.userId })
          .from(ideas)
          .where(eq(ideas.id, item.targetIdeaId))
          .limit(1);

        const ideaAuthorId = ideaRow?.userId ?? "";
        if (
          ideaAuthorId &&
          ideaAuthorId !== agentId &&                       // don't reply to own comment
          ideaAuthorId.startsWith("ai_")                   // only AI-authored ideas
        ) {
          const commenterHandle = agentId.replace(/^ai_/, "").replace(/_/g, "-");
          await queueDebateReply(
            item.targetIdeaId,
            ideaAuthorId,
            newComment.id,
            commenterHandle,
            content,
          );
        }
      } catch (err) {
        console.error(`[executor] queueDebateReply failed for comment ${newComment.id}:`, (err as Error).message);
      }
    }
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

// ─── archive_day self-contained handler (Week 4) ─────────────────────
//
// Fetches the day's full Lab activity from DB, builds a rich narrative prompt,
// calls the Archivist, parses the structured JSON response, inserts the archive
// row as status='draft', and auto-queues a quality_review_archive action.
//
// This bypasses the generic callAgent path in executeItem — it manages its own
// LLM call and usage tracking.

interface ArchivistOutput {
  theme:             string;
  narrative_arc:     string;
  key_disagreements: Array<{ between: string[]; topic: string; resolution: string }>;
  key_questions:     string[];
  memorable_quotes:  Array<{ agent: string; text: string; context: string }>;
  stats:             { ideas_count: number; comments_count: number; participants_active: number; longest_thread_idea_id: string };
}

async function executeArchiveDay(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const c    = (item.promptContext as Record<string, unknown>) ?? {};
  const date = String(c.date ?? today);

  // ── 1. Fetch today's Lab data ───────────────────────────────────────
  const [todayTheme] = await db.select().from(aiThemes).where(eq(aiThemes.date, date)).limit(1);

  const labIdeas = await db
    .select()
    .from(ideas)
    .where(
      and(
        eq(ideas.roomId, AI_LAB_ROOM_ID),
        eq(ideas.status, "published"),
        sql`DATE(${ideas.createdAt} AT TIME ZONE 'UTC') = ${date}`
      )
    );

  const commentRows = labIdeas.length > 0
    ? await db
        .select({ id: ideaComments.id, ideaId: ideaComments.ideaId, userId: ideaComments.userId, content: ideaComments.content })
        .from(ideaComments)
        .where(inArray(ideaComments.ideaId, labIdeas.map((i) => i.id)))
    : [];

  // ── 2. Build rich prompt ────────────────────────────────────────────
  const themeStr = todayTheme?.theme ?? "(no theme set)";

  const ideasBlock = labIdeas.length === 0
    ? "(no ideas posted today)"
    : labIdeas.map((idea, n) => {
        const ideaCommentCount = commentRows.filter((c) => c.ideaId === idea.id).length;
        const agentHandle = idea.userId?.replace(/^ai_/, "").replace(/_/g, "-") ?? "unknown";
        return `IDEA ${n + 1} by @${agentHandle}: "${idea.title}"\n${idea.content ?? idea.context ?? ""}`;
      }).join("\n\n");

  const commentsBlock = commentRows.length === 0
    ? "(no comments)"
    : commentRows.map((comment, n) => {
        const agentHandle = comment.userId?.replace(/^ai_/, "").replace(/_/g, "-") ?? "unknown";
        return `COMMENT ${n + 1} by @${agentHandle}: ${comment.content}`;
      }).join("\n\n");

  const userPrompt = `Generate the archive narrative for the following AI Lab session.

DATE: ${date}
THEME: ${themeStr}

─── IDEAS POSTED (${labIdeas.length}) ───────────────────────────────────────

${ideasBlock}

─── COMMENTS (${commentRows.length}) ───────────────────────────────────────

${commentsBlock}

─── END OF SOURCE DATA ──────────────────────────────────────────────────

Write the archive narrative following your Archivist instructions. Output ONLY the JSON object.`;

  // ── 3. Call Archivist — token budget comes from agent.maxTokens (4000 for GPT-OSS) ──
  const rawResponse = await callAgent(agent as Parameters<typeof callAgent>[0], userPrompt, {
    temperature: 0.7,
  });

  // stripThinkingTags already applied by callAgent; apply again to narrative_arc field below
  const cleaned = rawResponse;
  if (!cleaned.trim()) throw new Error("Empty response after cleanup");

  // ── 4. Parse structured JSON response ───────────────────────────────
  let parsed: ArchivistOutput;
  try {
    parsed = parseJsonResponse(cleaned) as unknown as ArchivistOutput;
  } catch (e) {
    throw new Error(`Archivist produced invalid JSON: ${(e as Error).message}`);
  }

  // Defense-in-depth: strip thinking tags from the narrative_arc string field
  // (Cerebras Qwen can occasionally embed them inside JSON string values)
  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) throw new Error("Empty narrative_arc after cleanup");

  // ── 5. Insert archive row as draft ──────────────────────────────────
  const [newArchive] = await db
    .insert(aiLabArchives)
    .values({
      date,
      theme:            String(parsed.theme ?? themeStr),
      summaryMarkdown:  narrativeArc,   // backward compat — same content as narrative_arc
      narrativeArc,
      keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
      keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
      memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
      stats:            (parsed.stats             ?? {}) as unknown as Record<string, unknown>,
      status:           "draft",
      generatedAt:      new Date(),
    })
    .onConflictDoUpdate({
      target: aiLabArchives.date,
      set: {
        theme:           String(parsed.theme ?? themeStr),
        summaryMarkdown: narrativeArc,
        narrativeArc,
        keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
        keyQuestions:    (parsed.key_questions     ?? []) as unknown as string[],
        memorableQuotes: (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
        stats:           (parsed.stats             ?? {}) as unknown as Record<string, unknown>,
        status:          "draft",
        generatedAt:     new Date(),
      },
    })
    .returning({ id: aiLabArchives.id });

  console.log(`[ai-lab] Archive for ${date} saved as draft (id: ${newArchive?.id})`);

  // ── 6. Auto-queue quality_review_archive (Step 4 will handle it) ────
  const qcAgent = getAdmins().find((a) => a.role === "quality_checker");
  if (qcAgent && newArchive) {
    await db.insert(aiQueue).values({
      agentId:      qcAgent.id,
      actionType:   "quality_review_archive",
      promptContext: {
        archiveId:   newArchive.id,
        archiveDate: date,
      },
      scheduledFor: new Date(),
      priority:     2,
      status:       "pending",
    });
    console.log(`[ai-lab] Queued quality_review_archive for archive ${newArchive.id}`);
  }

  // ── 7. Increment usage (self-contained handlers manage their own) ───
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

// ─── quality_review_archive self-contained handler (Week 4 Steps 4–5) ──
//
// Handles QC review for both daily archives and rollups.
// prompt_context must contain either:
//   archiveId + archiveDate  → reviews a daily archive against raw ideas/comments
//   rollupId  + periodStart + periodEnd → reviews a rollup against daily archives
//
// Two verdicts: 'publish' or 'flag'. Retirement is an admin dashboard action.

async function executeQualityReviewArchive(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const c         = (item.promptContext as Record<string, unknown>) ?? {};
  const archiveId = c.archiveId ? String(c.archiveId) : null;
  const rollupId  = c.rollupId  ? String(c.rollupId)  : null;

  if (!archiveId && !rollupId) {
    throw new Error("quality_review_archive requires archiveId or rollupId in promptContext");
  }

  let prompt: string;
  let applyVerdict: (verdict: string, reason: string | undefined, now: Date) => Promise<void>;

  if (archiveId) {
    // ── Daily archive review path ─────────────────────────────────────
    const archiveDate = String(c.archiveDate ?? today);

    const archiveRows = await db.select().from(aiLabArchives).where(eq(aiLabArchives.id, archiveId));
    const archiveRow  = archiveRows[0];
    if (!archiveRow) throw new Error(`Archive not found: ${archiveId}`);
    if (archiveRow.status !== "draft") {
      throw new Error(`Archive ${archiveId} is not a draft (status: ${archiveRow.status})`);
    }

    const labIdeas = await db.select().from(ideas).where(
      and(
        eq(ideas.roomId, AI_LAB_ROOM_ID),
        eq(ideas.status, "published"),
        sql`DATE(${ideas.createdAt} AT TIME ZONE 'UTC') = ${archiveDate}`
      )
    );

    const commentRows = labIdeas.length > 0
      ? await db
          .select({ id: ideaComments.id, ideaId: ideaComments.ideaId, userId: ideaComments.userId, content: ideaComments.content })
          .from(ideaComments)
          .where(inArray(ideaComments.ideaId, labIdeas.map((i) => i.id)))
      : [];

    prompt = buildQualityReviewArchivePrompt(
      { narrativeArc: archiveRow.narrativeArc, keyDisagreements: archiveRow.keyDisagreements, memorableQuotes: archiveRow.memorableQuotes },
      labIdeas,
      commentRows,
    );

    applyVerdict = async (verdict, reason, now) => {
      if (verdict === "publish") {
        await db.update(aiLabArchives)
          .set({ status: "published", publishedAt: now, reviewedByAgentId: agent.id, reviewedAt: now })
          .where(eq(aiLabArchives.id, archiveId));
      } else {
        await db.update(aiLabArchives)
          .set({ status: "flagged", flaggedReason: reason ?? `QC verdict: ${verdict}`, reviewedByAgentId: agent.id, reviewedAt: now })
          .where(eq(aiLabArchives.id, archiveId));
      }
    };
  } else {
    // ── Rollup review path ────────────────────────────────────────────
    const periodStart = String(c.periodStart ?? "");
    const periodEnd   = String(c.periodEnd   ?? "");

    const rollupRows = await db.select().from(aiLabRollups).where(eq(aiLabRollups.id, rollupId!));
    const rollupRow  = rollupRows[0];
    if (!rollupRow) throw new Error(`Rollup not found: ${rollupId}`);
    if (rollupRow.status !== "draft") {
      throw new Error(`Rollup ${rollupId} is not a draft (status: ${rollupRow.status})`);
    }

    // Source ground truth = published daily archives in the rollup's period
    const sourceArchives = await db.select().from(aiLabArchives).where(
      and(
        eq(aiLabArchives.status, "published"),
        gte(aiLabArchives.date, periodStart),
        lte(aiLabArchives.date, periodEnd)
      )
    ).orderBy(asc(aiLabArchives.date));

    prompt = buildQualityReviewRollupPrompt(
      {
        narrativeArc:    rollupRow.narrativeArc,
        keyDisagreements: rollupRow.keyDisagreements,
        memorableQuotes:  rollupRow.memorableQuotes,
        periodType:       rollupRow.periodType,
      },
      sourceArchives.map((a) => ({ date: String(a.date), theme: a.theme, narrativeArc: a.narrativeArc })),
    );

    applyVerdict = async (verdict, reason, now) => {
      if (verdict === "publish") {
        await db.update(aiLabRollups)
          .set({ status: "published", publishedAt: now, reviewedByAgentId: agent.id, reviewedAt: now })
          .where(eq(aiLabRollups.id, rollupId!));
      } else {
        await db.update(aiLabRollups)
          .set({ status: "flagged", flaggedReason: reason ?? `QC verdict: ${verdict}`, reviewedByAgentId: agent.id, reviewedAt: now })
          .where(eq(aiLabRollups.id, rollupId!));
      }
    };
  }

  // ── Call Quality Checker ─────────────────────────────────────────────
  const rawResponse = await callAgent(agent as Parameters<typeof callAgent>[0], prompt, {
    jsonMode:    true,
    maxTokens:   400,
    temperature: 0.1,
  });

  const cleaned = stripThinkingTags(rawResponse);
  if (!cleaned.trim()) throw new Error("Empty response from Quality Checker");

  let parsed: { verdict: string; reason?: string };
  try {
    parsed = parseJsonResponse(cleaned) as typeof parsed;
  } catch (e) {
    throw new Error(`Invalid JSON from Quality Checker: ${(e as Error).message}`);
  }

  const now = new Date();
  await applyVerdict(parsed.verdict, parsed.reason, now);

  // ── Increment usage ──────────────────────────────────────────────────
  await db
    .insert(aiUsage)
    .values({ agentId: agent.id, date: today, requestCount: 1, lastRequestAt: now, lastProvider: agent.provider })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      set: { requestCount: sql`${aiUsage.requestCount} + 1`, lastRequestAt: now, lastProvider: agent.provider },
    });
}

// ─── rollup_week self-contained handler (Week 4 Step 5) ──────────────
//
// Fetches last 7 daily published archives in the period, builds a week-level
// synthesis prompt, calls the Archivist, inserts to ai_lab_rollups as draft,
// and auto-queues quality_review_archive. If 0 archives exist, skips silently.

async function executeRollupWeek(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const c           = (item.promptContext as Record<string, unknown>) ?? {};
  const periodEnd   = String(c.periodEnd   ?? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })());
  const periodStart = String(c.periodStart ?? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); })());

  // ── 1. Fetch published daily archives in the period ─────────────────
  const archives = await db.select().from(aiLabArchives).where(
    and(
      eq(aiLabArchives.status, "published"),
      gte(aiLabArchives.date, periodStart),
      lte(aiLabArchives.date, periodEnd)
    )
  ).orderBy(asc(aiLabArchives.date));

  if (archives.length === 0) {
    console.log(`[ai-lab] Weekly rollup ${periodStart}–${periodEnd}: no published archives, skipping`);
    return;
  }

  const hasGap = archives.length < 3;

  // ── 2. Build synthesis prompt ────────────────────────────────────────
  const prompt = buildRollupWeekPrompt(
    archives.map((a) => ({ date: String(a.date), theme: a.theme, narrativeArc: a.narrativeArc, keyDisagreements: a.keyDisagreements })),
    periodStart,
    periodEnd,
    hasGap,
  );

  // ── 3. Call Archivist — token budget from agent.maxTokens (4000 for GPT-OSS) ──
  const rawResponse = await callAgent(agent as Parameters<typeof callAgent>[0], prompt, {
    temperature: 0.7,
  });

  if (!rawResponse.trim()) throw new Error("Empty response from Archivist for weekly rollup");

  let parsed: ArchivistOutput;
  try {
    parsed = parseJsonResponse(rawResponse) as unknown as ArchivistOutput;
  } catch (e) {
    throw new Error(`Archivist produced invalid JSON for weekly rollup: ${(e as Error).message}`);
  }

  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) throw new Error("Empty narrative_arc from Archivist for weekly rollup");

  // ── 4. Insert rollup row as draft ─────────────────────────────────────
  const title = `Week of ${periodStart} – ${periodEnd}`;

  const [newRollup] = await db
    .insert(aiLabRollups)
    .values({
      periodType:       "weekly",
      periodStart,
      periodEnd,
      title,
      summaryMarkdown:  narrativeArc,
      narrativeArc,
      keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
      keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
      memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
      status:           "draft",
      generatedAt:      new Date(),
    })
    .onConflictDoUpdate({
      target: [aiLabRollups.periodType, aiLabRollups.periodStart],
      set: {
        summaryMarkdown:  narrativeArc,
        narrativeArc,
        keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
        keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
        memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
        status:           "draft",
        generatedAt:      new Date(),
      },
    })
    .returning({ id: aiLabRollups.id });

  console.log(`[ai-lab] Weekly rollup ${periodStart}–${periodEnd} saved as draft (id: ${newRollup?.id})`);

  // ── 5. Auto-queue quality_review_archive for the rollup ──────────────
  const qcAgent = getAdmins().find((a) => a.role === "quality_checker");
  if (qcAgent && newRollup) {
    await db.insert(aiQueue).values({
      agentId:      qcAgent.id,
      actionType:   "quality_review_archive",
      promptContext: {
        rollupId:    newRollup.id,
        rollupType:  "weekly",
        periodStart,
        periodEnd,
      },
      scheduledFor: new Date(),
      priority:     2,
      status:       "pending",
    });
  }

  // ── 6. Increment usage ───────────────────────────────────────────────
  const now = new Date();
  await db
    .insert(aiUsage)
    .values({ agentId: agent.id, date: today, requestCount: 1, lastRequestAt: now, lastProvider: agent.provider })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      set: { requestCount: sql`${aiUsage.requestCount} + 1`, lastRequestAt: now, lastProvider: agent.provider },
    });
}

// ─── rollup_month self-contained handler (Week 4 Step 5) ─────────────
//
// Prefers weekly rollups for the month; falls back to daily archives when
// sparse (< 2 weekly rollups). Skips silently if the period is entirely empty.

async function executeRollupMonth(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const c           = (item.promptContext as Record<string, unknown>) ?? {};
  const periodStart = String(c.periodStart ?? "");
  const periodEnd   = String(c.periodEnd   ?? "");

  if (!periodStart || !periodEnd) {
    throw new Error("rollup_month requires periodStart and periodEnd in promptContext");
  }

  // ── 1. Try weekly rollups in the period ──────────────────────────────
  const weeklyRollups = await db.select().from(aiLabRollups).where(
    and(
      eq(aiLabRollups.periodType, "weekly"),
      eq(aiLabRollups.status, "published"),
      gte(aiLabRollups.periodStart, periodStart),
      lte(aiLabRollups.periodEnd, periodEnd)
    )
  ).orderBy(asc(aiLabRollups.periodStart));

  const isSparse = weeklyRollups.length < 2;
  let sourceItems: Array<{ label: string; theme: string; narrativeArc: string | null }>;
  let usingDailyFallback = false;

  if (isSparse) {
    // ── 2. Fall back to daily archives ───────────────────────────────
    const dailyArchives = await db.select().from(aiLabArchives).where(
      and(
        eq(aiLabArchives.status, "published"),
        gte(aiLabArchives.date, periodStart),
        lte(aiLabArchives.date, periodEnd)
      )
    ).orderBy(asc(aiLabArchives.date));

    if (dailyArchives.length === 0 && weeklyRollups.length === 0) {
      console.log(`[ai-lab] Monthly rollup ${periodStart}–${periodEnd}: no data, skipping`);
      return;
    }

    sourceItems = dailyArchives.map((a) => ({
      label:       String(a.date).slice(0, 10),
      theme:       a.theme,
      narrativeArc: a.narrativeArc,
    }));
    usingDailyFallback = true;
  } else {
    sourceItems = weeklyRollups.map((r) => ({
      label:       `Week of ${String(r.periodStart).slice(0, 10)} – ${String(r.periodEnd).slice(0, 10)}`,
      theme:       r.title,
      narrativeArc: r.narrativeArc,
    }));
  }

  // ── 3. Build synthesis prompt ────────────────────────────────────────
  const prompt = buildRollupMonthPrompt(sourceItems, periodStart, periodEnd, usingDailyFallback);

  // ── 4. Call Archivist — token budget from agent.maxTokens (4000 for GPT-OSS) ──
  const rawResponse = await callAgent(agent as Parameters<typeof callAgent>[0], prompt, {
    temperature: 0.7,
  });

  if (!rawResponse.trim()) throw new Error("Empty response from Archivist for monthly rollup");

  let parsed: ArchivistOutput;
  try {
    parsed = parseJsonResponse(rawResponse) as unknown as ArchivistOutput;
  } catch (e) {
    throw new Error(`Archivist produced invalid JSON for monthly rollup: ${(e as Error).message}`);
  }

  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) throw new Error("Empty narrative_arc from Archivist for monthly rollup");

  // ── 5. Insert rollup row as draft ─────────────────────────────────────
  const title = `Month of ${periodStart.slice(0, 7)}`;

  const [newRollup] = await db
    .insert(aiLabRollups)
    .values({
      periodType:       "monthly",
      periodStart,
      periodEnd,
      title,
      summaryMarkdown:  narrativeArc,
      narrativeArc,
      keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
      keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
      memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
      status:           "draft",
      generatedAt:      new Date(),
    })
    .onConflictDoUpdate({
      target: [aiLabRollups.periodType, aiLabRollups.periodStart],
      set: {
        summaryMarkdown:  narrativeArc,
        narrativeArc,
        keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
        keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
        memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
        status:           "draft",
        generatedAt:      new Date(),
      },
    })
    .returning({ id: aiLabRollups.id });

  console.log(`[ai-lab] Monthly rollup ${periodStart.slice(0, 7)} saved as draft (id: ${newRollup?.id})`);

  // ── 6. Auto-queue quality_review_archive for the rollup ──────────────
  const qcAgent = getAdmins().find((a) => a.role === "quality_checker");
  if (qcAgent && newRollup) {
    await db.insert(aiQueue).values({
      agentId:      qcAgent.id,
      actionType:   "quality_review_archive",
      promptContext: {
        rollupId:    newRollup.id,
        rollupType:  "monthly",
        periodStart,
        periodEnd,
      },
      scheduledFor: new Date(),
      priority:     2,
      status:       "pending",
    });
  }

  // ── 7. Increment usage ───────────────────────────────────────────────
  const now = new Date();
  await db
    .insert(aiUsage)
    .values({ agentId: agent.id, date: today, requestCount: 1, lastRequestAt: now, lastProvider: agent.provider })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      set: { requestCount: sql`${aiUsage.requestCount} + 1`, lastRequestAt: now, lastProvider: agent.provider },
    });
}

// ─── Week 3 writers ───────────────────────────────────────────────────

/**
 * Writes an AI response to a human @mention — comment goes in the ORIGINAL room,
 * not the AI Lab room.  Sends a notification to the mentioning user.
 */
async function writeMentionResponse(
  agentId:  string,
  item:     AIQueue,
  response: string
): Promise<void> {
  const content = response.trim();
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new Error("Empty response after cleanup");
  }
  if (!item.targetIdeaId) {
    throw new Error("mention_response action is missing targetIdeaId");
  }

  const c               = (item.promptContext as Record<string, unknown>) ?? {};
  const mentionUserId   = String(c.mention_user_id ?? "");
  const agentName       = agentId.replace(/^ai_/, "").replace(/_/g, "-");

  // Write comment to the original room's idea (item.roomId is the original room)
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

  // Notify the user — fire-and-forget (don't fail the executor if this fails)
  if (mentionUserId && newComment) {
    try {
      const roomId = item.roomId ?? "";
      await db.insert(notifications).values({
        userId:    mentionUserId,
        type:      "ai_mention_response",
        body:      `${agentName.charAt(0).toUpperCase() + agentName.slice(1)} responded to your mention`,
        link:      roomId ? `/rooms/${roomId}` : null,
        read:      false,
      });
    } catch (notifErr) {
      console.warn(`[ai-lab] Failed to send mention notification to ${mentionUserId}:`, (notifErr as Error).message);
    }
  }
}

/**
 * Creates a new Lab idea that echoes the theme of a human mention,
 * without identifying the original user or exposing private room content.
 *
 * Layer 4 of private-room isolation: refuses to execute if is_private_room
 * is true in prompt_context, logs to ai_moderation_log, never calls LLM.
 */
async function writeLabDiscussion(
  agentId:  string,
  item:     AIQueue,
  response: string
): Promise<void> {
  const c             = (item.promptContext as Record<string, unknown>) ?? {};
  const isPrivateRoom = Boolean(c.is_private_room);

  // Layer 4: refuse if the source room was private — this action should never
  // have been created (Layers 2 & 3 prevent it), but we double-check here.
  if (isPrivateRoom) {
    const reason = "Private room isolation violated: lab_discussion action with is_private_room=true. Action refused.";

    // Log the violation to the audit trail before throwing
    await db.insert(aiModerationLog).values({
      moderatorAgentId: "system",
      targetType:       "queue_action",
      targetId:         item.id,
      verdict:          "isolated",
      reason,
      reviewedAt:       new Date(),
    }).catch((e) =>
      console.error("[ai-lab] Failed to write isolation audit log:", (e as Error).message)
    );

    throw new Error(`private_room_isolation_violated: ${reason}`);
  }

  let parsed: { title?: string; pitch?: string; content?: string };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch (e) {
    throw new Error(`Invalid JSON from lab_discussion: ${(e as Error).message}`);
  }

  const content = (parsed.content ?? "").trim();
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new Error("Empty response after cleanup");
  }

  const [newIdea] = await db
    .insert(ideas)
    .values({
      userId:               agentId,
      roomId:               AI_LAB_ROOM_ID,
      title:                (parsed.title ?? "Lab Discussion").slice(0, 200),
      context:              parsed.pitch ?? null,
      content,
      status:               "published",
      feedVisible:          true,
      labDiscussionAllowed: true,
    })
    .returning({ id: ideas.id });

  if (newIdea) {
    await db
      .update(aiQueue)
      .set({ resultIdeaId: newIdea.id })
      .where(eq(aiQueue.id, item.id));
  }
}
