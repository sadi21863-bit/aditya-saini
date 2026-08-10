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
  searchCache, notifications, quickDebates,
  debates, debateParticipants, debateTurns, debateQuestions,
  aiLabOptouts, users,
} from "@/db/schema";
import {
  getDebateById, getDebateParticipants, getDebateTurns,
} from "@/lib/agents/debate-helpers";
import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { getAgent, getAdmins, getResearchAgent } from "./personas";
import { callAgent } from "./providers/index";
import { callGroq } from "./providers/groq";
import { callGitHub } from "./providers/github";
import { queueCommentsOnIdea, queueConductorIntervention, queueQualityReview, queueDebateReply } from "./scheduler";
import {
  buildPrompt,
  buildIdeaSummaryPrompt,
  buildQualityReviewArchivePrompt,
  buildQualityReviewRollupPrompt,
  buildRollupWeekPrompt,
  buildRollupMonthPrompt,
  buildDebateTurnPrompt,
  buildDebateArchivePrompt,
  buildRound2TurnPrompt,
  buildRound2ArchivePrompt,
  buildAILabDebateJudgePrompt,
  buildAILabDebateTurnPrompt,
} from "./prompts";
import { stripThinkingTags } from "./response-cleaner";
import { parseJsonResponse } from "./json-helpers";
import { fetchResearch, formatResearchBlock, type SourceCitation } from "./research";
import type { AIQueue } from "@/db/schema";
import { QUOTA_CONFIG } from "@/lib/config";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID!;

/** Minimum text length accepted for ideas and comments. */
const MIN_CONTENT_LENGTH = 50;

// ── Shared usage upsert ──────────────────────────────────────────────────────

async function upsertUsage(
  agentId:  string,
  date:     string,
  provider  = "groq",
  feature   = "ai_lab",
): Promise<void> {
  await db
    .insert(aiUsage)
    .values({ agentId, date, requestCount: 1, lastRequestAt: new Date(), lastProvider: provider, feature })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      // unique_ai_usage_agent_date is a PARTIAL index (WHERE agent_id IS NOT NULL AND date
      // IS NOT NULL — added by migration 0010 to also allow NULL-agentId rate-limit rows).
      // Without a matching targetWhere, Postgres rejects this as "no unique or exclusion
      // constraint matching the ON CONFLICT specification" — every call site below needs it.
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
      set: { requestCount: sql`${aiUsage.requestCount} + 1`, lastRequestAt: new Date(), lastProvider: provider },
    });
}

// ── Research pre-call ────────────────────────────────────────────────────────

async function shouldFetchResearch(
  ideaTitle: string,
  theme: string,
  actionType: string
): Promise<{ needsResearch: boolean; query: string } | null> {
  try {
    const prompt = `You are deciding whether a response to the following debate topic needs current real-world data.

DEBATE TOPIC: "${ideaTitle}"
TODAY'S THEME: "${theme}"
ACTION: ${actionType}

Does responding well to this topic require looking up current facts, statistics, or recent events?
Only say yes if the topic involves specific empirical claims, recent developments, or data that changes over time.
Say no for topics that are philosophical, speculative, or based entirely on reasoning.

Respond in JSON only:
{"needsResearch": true/false, "query": "2-5 word search query if yes, null if no"}`;

    const raw = await callGroq(
      process.env.AGENT_MODEL_FALLBACK ?? "openai/gpt-oss-20b",
      "You are a research triage assistant. Respond in JSON only.",
      prompt,
      { maxTokens: 80, jsonMode: true }
    );
    const parsed = JSON.parse(raw.trim());
    return { needsResearch: Boolean(parsed.needsResearch), query: String(parsed.query ?? "") };
  } catch {
    return null;
  }
}

async function writeResearchComment(
  ideaId:    string,
  citations: SourceCitation[],
  ideaTitle: string,
): Promise<void> {
  const researchAgent = getResearchAgent();
  const today = new Date().toISOString().slice(0, 10);

  // Dedup: only one @research comment per idea per day regardless of how many
  // participants trigger research. Without this, all 4 participants posting on
  // an empirical topic each post their own @research comment.
  const [existing] = await db
    .select({ id: ideaComments.id })
    .from(ideaComments)
    .where(
      and(
        eq(ideaComments.ideaId, ideaId),
        eq(ideaComments.userId, researchAgent.id),
        gte(ideaComments.createdAt, new Date(`${today}T00:00:00Z`))
      )
    )
    .limit(1);
  if (existing) {
    console.log(`[executor] @research already posted for idea ${ideaId} today — skipping`);
    return;
  }

  const citationText = citations
    .slice(0, 3)
    .map((c, i) => `${i + 1}. [${c.source}] ${c.title} — ${c.summary}`)
    .join("\n");

  const synthesisPrompt = `Synthesize these recent headlines into a factual 120-150 word summary relevant to this debate:

DEBATE TOPIC: "${ideaTitle}"

RECENT HEADLINES:
${citationText}

Format:
@research — [topic in brackets]:
[3-4 sentences presenting facts, contradictions, and unknowns]
Current evidence: [one neutral sentence]

No opinions. No predictions. Facts only.`;

  try {
    const summary = await callGroq(
      process.env.AGENT_MODEL_FALLBACK ?? "openai/gpt-oss-20b",
      researchAgent.persona,
      synthesisPrompt,
      { maxTokens: 200 }
    );

    const [newComment] = await db
      .insert(ideaComments)
      .values({ ideaId, userId: researchAgent.id, content: summary.trim(), parentId: null })
      .returning({ id: ideaComments.id });

    if (newComment) {
      await db
        .update(ideas)
        .set({ totalComments: sql`${ideas.totalComments} + 1` })
        .where(eq(ideas.id, ideaId));
    }

    await upsertUsage(researchAgent.id, today);
    console.log(`[executor] @research posted for idea ${ideaId}`);
  } catch (e) {
    console.error("[executor] writeResearchComment failed:", (e as Error).message);
  }
}

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

  if (claimedIds.length === 0) return { processed: 0, failed: 0, errors: [] };

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
      const message       = err instanceof Error ? err.message : String(err);
      const isRateLimited = message.startsWith("rate_limited");
      const newRetryCount = (item.retryCount ?? 0) + 1;
      const isPermanent   = !isRateLimited && newRetryCount >= 3;
      const status        = isRateLimited
        ? "rate_limited"
        : isPermanent
          ? "failed_permanently"
          : "failed";

      await db
        .update(aiQueue)
        .set({ status, errorMessage: message, executedAt: new Date(), retryCount: newRetryCount })
        .where(eq(aiQueue.id, item.id));

      if (isPermanent) {
        console.error(
          `[ai-lab] DEAD LETTER: job ${item.id} (${item.actionType} / ${item.agentId}) failed permanently after ${newRetryCount} attempts. Last error: ${message}`
        );
      }

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

  // Reset items stuck in_progress > 10 min
  const stuckReset = await db
    .update(aiQueue)
    .set({ status: "pending", errorMessage: "reset by catchup — was stuck in_progress" })
    .where(and(
      eq(aiQueue.status, "in_progress"),
      lt(aiQueue.scheduledFor, staleThreshold),
      lt(aiQueue.retryCount, 3),
    ))
    .returning({ id: aiQueue.id });

  // Re-queue deferred items — quota resets at midnight UTC, so they're eligible again
  const deferredReset = await db
    .update(aiQueue)
    .set({ status: "pending", errorMessage: null })
    .where(eq(aiQueue.status, "deferred"))
    .returning({ id: aiQueue.id });

  return stuckReset.length + deferredReset.length;
}

// ─── Per-item execution ───────────────────────────────────────────────

async function executeItem(item: AIQueue): Promise<void> {
  const agent = getAgent(item.agentId);
  if (!agent) throw new Error(`Agent not found: ${item.agentId}`);

  // Rate limit check — throw with "rate_limited:" prefix so outer catch
  // can distinguish it from a real failure and set the correct status.
  // debate_turn and debate_archive are user-initiated Quick Debate actions with
  // their own per-user API-level rate limits (5/day). Exclude them from the
  // per-agent AI Lab daily cap so a busy AI Lab day can't block Quick Debate.
  const today = new Date().toISOString().slice(0, 10);
  const QUICK_DEBATE_ACTIONS = new Set(["debate_turn", "debate_archive"]);
  if (!QUICK_DEBATE_ACTIONS.has(item.actionType)) {
    const [usage] = await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.agentId, agent.id), eq(aiUsage.date, today)));

    if (usage && usage.requestCount >= agent.dailyLimit) {
      throw new Error(`rate_limited: ${agent.handle} has reached daily limit (${agent.dailyLimit})`);
    }
  }

  // Quota enforcement: check feature-level daily token budget before any LLM work.
  // Deferred items are retried at the next queue tick, not dead-lettered.
  const featureLabel = QUICK_DEBATE_ACTIONS.has(item.actionType) ? "quick_debate" : "ai_lab";
  const budgetFraction = featureLabel === "quick_debate"
    ? QUOTA_CONFIG.QUICK_DEBATE_BUDGET_FRACTION
    : QUOTA_CONFIG.AI_LAB_BUDGET_FRACTION;
  const dailyCeiling = Math.floor(QUOTA_CONFIG.DAILY_TPD_LIMIT * budgetFraction);

  const startOfDayUTC = new Date(new Date().setUTCHours(0, 0, 0, 0));
  const [usageRow] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.tokens}), 0)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.feature, featureLabel), gte(aiUsage.createdAt, startOfDayUTC)));

  if (Number(usageRow?.total ?? 0) >= dailyCeiling) {
    await db.update(aiQueue)
      .set({ status: "deferred", errorMessage: `quota_exceeded: ${featureLabel} daily budget` })
      .where(eq(aiQueue.id, item.id));
    await db.insert(aiModerationLog).values({
      moderatorAgentId: "system",
      targetType:       "quota",
      targetId:         item.id,
      verdict:          "deferred",
      reason:           `Feature ${featureLabel} exceeded daily budget (${dailyCeiling} TPD). Item deferred.`,
      reviewedAt:       new Date(),
    }).catch(() => null);
    console.log(`[executor] quota_exceeded for ${featureLabel} — item ${item.id} deferred`);
    return;
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

  // Opt-out check: if this is a @mention response, skip it when the mentioning
  // user has opted out of this specific agent or all agents.
  if (item.actionType === "comment") {
    const pc            = (item.promptContext as Record<string, unknown>) ?? {};
    const isMention     = pc.kind === "mention_response";
    const mentionUserId = isMention ? String(pc.mention_user_id ?? "") : "";
    if (isMention && mentionUserId) {
      const [optout] = await db
        .select({ id: aiLabOptouts.id })
        .from(aiLabOptouts)
        .where(
          and(
            eq(aiLabOptouts.userId, mentionUserId),
            or(
              and(eq(aiLabOptouts.targetType, "agent"), eq(aiLabOptouts.targetId, item.agentId)),
              and(eq(aiLabOptouts.targetType, "all"),   eq(aiLabOptouts.targetId, "all")),
            ),
          ),
        )
        .limit(1);
      if (optout) {
        await db
          .update(aiQueue)
          .set({ status: "skipped", errorMessage: "user_optout" })
          .where(eq(aiQueue.id, item.id));
        console.log(`[executor] @mention skipped for user ${mentionUserId} — opted out of agent ${item.agentId}`);
        return;
      }
    }
  }

  // Self-contained handlers — fetch their own data, manage their own LLM calls
  // and usage tracking, then return early, bypassing the generic callAgent path.

  // themeresearch: pure API fetch + cache write. No LLM call, no usage increment.
  if (item.actionType === "themeresearch") {
    const c    = (item.promptContext as { date: string; query: string });
    const date = c.date ?? new Date().toISOString().slice(0, 10);
    const query = c.query ?? "";
    const { citations, source } = await fetchResearch(query, date);
    console.log(`[executor] themeresearch: ${citations.length} citations from ${source}`);
    await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
    return;
  }

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

  if (item.actionType === "quick_debate_seed") {
    await executeQuickDebateSeed(agent, item, today);
    return;
  }

  if (item.actionType === "quick_debate_reply") {
    await executeQuickDebateReply(agent, item, today);
    return;
  }

  if (item.actionType === "quick_debate_archive") {
    await executeQuickDebateArchive(agent, item, today);
    return;
  }

  if (item.actionType === "debate_turn") {
    await executeDebateTurn(agent, item, today);
    return;
  }

  if (item.actionType === "debate_archive") {
    await executeDebateArchive(item);
    return;
  }

  // conductor: builds its own prompt inline (writeConductorQuestion) and posts
  // directly — never had a buildPrompt() case, so it must short-circuit here
  // rather than falling into the generic callAgent path below, which throws
  // "No prompt template for action type: conductor" before ever reaching the
  // case "conductor" branch in the writer switch further down.
  if (item.actionType === "conductor") {
    await writeConductorQuestion(agent.id, item);
    return;
  }

  if (item.actionType === "ai_lab_debate") {
    await executeAILabDebate(agent, item, today);
    return;
  }

  // Research pre-call for participant and QC actions.
  // Participants: fetches + posts @research publicly, injects into prompt.
  // QC: fetches silently for fact-checking, does NOT post publicly.
  let researchInjection = "";
  if (item.actionType === "quality_review" && agent.role === "quality_checker") {
    const c2       = (item.promptContext as Record<string, unknown>) ?? {};
    const content  = String(c2.content ?? "");
    const qcTitle  = String(c2.ideaTitle ?? c2.idea_title ?? content.slice(0, 60));
    const qcTheme  = String(c2.theme ?? "");
    if (qcTitle) {
      try {
        const decision = await shouldFetchResearch(qcTitle, qcTheme, "quality_review");
        if (decision?.needsResearch && decision.query) {
          const result = await fetchResearch(decision.query, today);
          if (result.citations.length >= 2) {
            researchInjection = formatResearchBlock(result.citations, "FACT-CHECK CONTEXT — use this to verify factual claims");
          }
        }
      } catch (e) {
        console.warn("[executor] QC research pre-call error:", (e as Error).message);
      }
    }
  }

  if ((item.actionType === "comment" || item.actionType === "debate_reply") && agent.role === "participant") {
    const c2        = (item.promptContext as Record<string, unknown>) ?? {};
    const ideaTitle = String(c2.ideaTitle ?? c2.idea_title ?? "");
    const theme     = String(c2.theme ?? "");
    if (ideaTitle) {
      try {
        const decision = await shouldFetchResearch(ideaTitle, theme, item.actionType);
        if (decision?.needsResearch && decision.query) {
          const date   = today;
          const result = await fetchResearch(decision.query, date);
          if (result.citations.length >= 2 && item.targetIdeaId) {
            await writeResearchComment(item.targetIdeaId, result.citations, ideaTitle);
            researchInjection = formatResearchBlock(result.citations, "CURRENT DATA (@research just posted this)");
            console.log(`[executor] Research injected for ${agent.handle} — ${decision.query}`);
          }
        }
      } catch (e) {
        console.warn("[executor] Research pre-call error:", (e as Error).message);
      }
    }
  }

  // Build prompt and call LLM.
  // jsonMode: true enables response_format: { type: "json_object" } on Groq for
  // models that support it (Llama). Ignored for models that don't (Qwen3, GPT-OSS).
  const JSON_ACTIONS = new Set(["theme_select", "post_idea", "quality_review"]);
  const prompt      = buildPrompt(item, researchInjection);
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
    // conductor, archive_day, and quality_review_archive handled by self-contained early returns above
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
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
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

    await db
      .update(ideas)
      .set({ totalComments: sql`${ideas.totalComments} + 1` })
      .where(eq(ideas.id, item.targetIdeaId));

    // Cascade: queue quality review for this comment
    try {
      await queueQualityReview(newComment.id, "comment");
    } catch (err) {
      console.error(`[executor] queueQualityReview failed for comment ${newComment.id}:`, (err as Error).message);
    }

    // Conductor: schedule a stall-check 90 min after this comment for non-cascade comments.
    if (item.targetIdeaId && !parentId && c.kind !== "debate_reply" && c.kind !== "mention_response") {
      try {
        await queueConductorIntervention(item.targetIdeaId);
      } catch (err) {
        console.error(`[executor] queueConductorIntervention failed for idea ${item.targetIdeaId}:`, (err as Error).message);
      }
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
  let parsed: { verdict: string; reason?: string; improvement_note?: string; factual_note?: string };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch (e) {
    throw new Error(`Invalid JSON from Quality Checker: ${(e as Error).message}`);
  }

  const c          = (item.promptContext as Record<string, unknown>) ?? {};
  const targetType = String(c.targetType ?? "idea");
  const targetId   = String(c.targetId   ?? item.targetIdeaId ?? "");

  // Append factual_note to reason when QC includes fact-check result
  const factualSuffix = parsed.factual_note ? ` | factual: ${parsed.factual_note}` : "";
  const fullReason    = (parsed.reason ?? "") + factualSuffix || null;

  await db.insert(aiModerationLog).values({
    moderatorAgentId: agentId,
    targetType,
    targetId,
    verdict:    parsed.verdict,
    reason:     fullReason,
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
  strongest_voice_agent_handle?: string | null;
}

async function executeArchiveDay(
  agent: ReturnType<typeof getAgent> & object,
  item:  AIQueue,
  today: string
): Promise<void> {
  const c    = (item.promptContext as Record<string, unknown>) ?? {};
  const date = String(c.date ?? today);

  // ── 1. Fetch the day's Lab data ────────────────────────────────────────────
  const [todayTheme] = await db.select().from(aiThemes).where(eq(aiThemes.date, date)).limit(1);
  const themeStr = todayTheme?.theme ?? "(no theme set)";

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

  if (labIdeas.length === 0) {
    console.log(`[executor] archive_day: no ideas for ${date}, marking completed`);
    await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
    return;
  }

  const allCommentRows = await db
    .select({ id: ideaComments.id, ideaId: ideaComments.ideaId, userId: ideaComments.userId, content: ideaComments.content })
    .from(ideaComments)
    .where(inArray(ideaComments.ideaId, labIdeas.map((i) => i.id)));

  // ── 2. Fetch cached research for the archive date (not necessarily today) ──
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay   = new Date(`${date}T23:59:59Z`);
  const [archiveResearchRow] = await db
    .select({ results: searchCache.results })
    .from(searchCache)
    .where(and(gte(searchCache.fetchedAt, startOfDay), lte(searchCache.fetchedAt, endOfDay)))
    .orderBy(desc(searchCache.fetchedAt))
    .limit(1);
  const researchBlock = archiveResearchRow?.results
    ? formatResearchBlock(archiveResearchRow.results as SourceCitation[], "TODAY'S REAL-WORLD CONTEXT")
    : "";

  // ── PASS 1: per-idea debate summaries (gpt-oss-20b, ~1,500–2,000 tokens each) ──
  // GitHub Models enforces an 8,000 token hard per-request limit on all free-tier models.
  // The full prompt (9k–13k tokens on busy days) exceeds this. Summarising each idea
  // individually keeps every Pass 1 call well within budget.
  // 2026-08-07: GitHub Models retired → openai/gpt-oss-20b on Groq (JSON mode verified live).
  const ideaSummaries: Array<{
    title:   string;
    summary: string;
    quotes:  Array<{ agent: string; text: string; context: string }>;
  }> = [];

  for (const idea of labIdeas) {
    const commentList = allCommentRows
      .filter((r) => r.ideaId === idea.id)
      .map((r) => ({
        handle:     (r.userId ?? "unknown").replace(/^ai_/, "").replace(/_/g, "-"),
        content:    r.content ?? "",
        isResearch: r.userId === "ai_research",
      }));

    const summaryPrompt = buildIdeaSummaryPrompt(
      idea.title   ?? "(untitled)",
      idea.content ?? idea.context ?? "",
      commentList
    );

    try {
      const raw     = await callGroq(
        "openai/gpt-oss-20b",
        "You are a precise debate analyst. Respond with JSON only. No markdown fences.",
        summaryPrompt,
        { temperature: 0.3, maxTokens: 400, jsonMode: true }
      );
      const p = parseJsonResponse(raw) as { summary: string; quotes: Array<{ agent: string; text: string; context: string }> };
      ideaSummaries.push({
        title:   idea.title ?? "(untitled)",
        summary: String(p.summary ?? ""),
        quotes:  Array.isArray(p.quotes) ? p.quotes : [],
      });
    } catch (e) {
      console.warn(`[executor] archive Pass 1 failed for idea ${idea.id}:`, (e as Error).message);
      ideaSummaries.push({ title: idea.title ?? "(untitled)", summary: "(summary unavailable)", quotes: [] });
    }
  }

  // ── PASS 2: synthesis (openai/gpt-oss-120b, ~3,000 tokens) ──────────────────────
  // Structured summaries from Pass 1 replace the raw idea/comment dump.
  // Input is ~3k tokens. JSON mode enforced natively (gpt-oss-120b verified).
  // 2026-08-07: GitHub Models retired → Groq openai/gpt-oss-120b.
  const summaryBlock = ideaSummaries
    .map((s, i) =>
      `IDEA ${i + 1}: "${s.title}"\n${s.summary}${
        s.quotes.length > 0
          ? `\nQuote candidates: ${s.quotes.map((q) => `@${q.agent}: "${q.text}"`).join(" | ")}`
          : ""
      }`
    )
    .join("\n\n---\n\n");

  const synthesisPrompt = `Generate the archive for the AI Lab session on ${date}.

THEME: ${themeStr}
${researchBlock}
DEBATE SUMMARIES (${labIdeas.length} ideas, ${allCommentRows.length} total comments):

${summaryBlock}

STATS:
- ideas_count: ${labIdeas.length}
- comments_count: ${allCommentRows.length}
- participants_active: ${new Set(allCommentRows.map((r) => r.userId).filter(Boolean)).size}

Write the full archive narrative following your Archivist instructions.
Use the quote candidates above for memorable_quotes — copy verbatim, do not paraphrase.
Include a "strongest_voice_agent_handle" field — the handle of the single agent whose argument was most incisive, original, or well-supported today. Use the exact handle string as it appears in the agent identifiers above (e.g. "llama", "scout", "maverick"). If no agent clearly stood out, omit the field or set it to null.
Output ONLY the JSON object.`;

  const rawResponse = await callGroq(
    agent.model,   // openai/gpt-oss-120b
    agent.persona,
    synthesisPrompt,
    { temperature: 0.7, maxTokens: agent.maxTokens ?? 4000, jsonMode: true }
  );

  if (!rawResponse.trim()) throw new Error("Empty response from archivist synthesis");

  // ── 4. Parse ──────────────────────────────────────────────────────────────
  let parsed: ArchivistOutput;
  try {
    parsed = parseJsonResponse(rawResponse) as unknown as ArchivistOutput;
  } catch (e) {
    throw new Error(`Archivist produced invalid JSON: ${(e as Error).message}`);
  }

  const narrativeArc = stripThinkingTags(String(parsed.narrative_arc ?? "")).trim();
  if (!narrativeArc) throw new Error("Empty narrative_arc after cleanup");

  // Resolve strongest_voice_agent_handle → users.id
  let winnerAgentId: string | null = null;
  const strongestHandle = parsed.strongest_voice_agent_handle?.trim().toLowerCase();
  if (strongestHandle) {
    const [winnerRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.handle, strongestHandle), eq(users.isAi, true)))
      .limit(1);
    winnerAgentId = winnerRow?.id ?? null;
  }

  // ── 5. Insert archive row as published ──────────────────────────────
  // 2026-08-07: archives are published immediately — the QC approval gate
  // (quality_review_archive) was removed. Every daily archive since 06-10
  // was stuck in 'flagged' due to quote-fidelity nits, blocking rollups.
  const now = new Date();
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
      status:           "published",
      publishedAt:      now,
      generatedAt:      now,
      winnerAgentId,
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
        stats:           (parsed.stats             ?? {}) as unknown as Record<string, unknown>[],
        status:          "published",
        publishedAt:     now,
        generatedAt:     now,
        winnerAgentId,
      },
    })
    .returning({ id: aiLabArchives.id });

  console.log(`[ai-lab] Archive for ${date} published (id: ${newArchive?.id})`);

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
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
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
    if (archiveRow.status === "published") {
      // Already published by a concurrent run — idempotent success
      console.log(`[executor] quality_review_archive: archive ${archiveId} already published, skipping`);
      await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
      return;
    }
    if (archiveRow.status !== "draft") {
      throw new Error(`Archive ${archiveId} is not reviewable (status: ${archiveRow.status})`);
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

    // Summarize each idea before building the QC prompt — the old approach dumped
    // every idea's full content + every comment verbatim, which reliably exceeded
    // GitHub Models' 8k-token per-request limit, leaving every archive stuck in
    // 'draft' forever. Same Pass-1 pattern as executeArchiveDay. Quote fidelity is
    // still checked byte-for-byte against commentRows below — only the "what
    // happened" context passed to the LLM is summarized.
    // 2026-08-07: GitHub Models retired → openai/gpt-oss-20b on Groq.
    const ideaSummaries: Array<{ title: string; handle: string; summary: string }> = [];
    for (const idea of labIdeas) {
      const handle = (idea.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-");
      const commentList = commentRows
        .filter((r) => r.ideaId === idea.id)
        .map((r) => ({
          handle:     (r.userId ?? "unknown").replace(/^ai_/, "").replace(/_/g, "-"),
          content:    r.content ?? "",
          isResearch: r.userId === "ai_research",
        }));

      const summaryPrompt = buildIdeaSummaryPrompt(idea.title ?? "(untitled)", idea.content ?? idea.context ?? "", commentList);
      try {
        const raw = await callGroq(
          "openai/gpt-oss-20b",
          "You are a precise debate analyst. Respond with JSON only. No markdown fences.",
          summaryPrompt,
          { temperature: 0.3, maxTokens: 400, jsonMode: true }
        );
        const p = parseJsonResponse(raw) as { summary: string };
        ideaSummaries.push({ title: idea.title ?? "(untitled)", handle, summary: String(p.summary ?? "") });
      } catch (e) {
        console.warn(`[executor] QC archive-review Pass 1 failed for idea ${idea.id}:`, (e as Error).message);
        ideaSummaries.push({ title: idea.title ?? "(untitled)", handle, summary: "(summary unavailable)" });
      }
    }

    prompt = buildQualityReviewArchivePrompt(
      { narrativeArc: archiveRow.narrativeArc, keyDisagreements: archiveRow.keyDisagreements, memorableQuotes: archiveRow.memorableQuotes },
      ideaSummaries,
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
    if (rollupRow.status === "published") {
      console.log(`[executor] quality_review_archive: rollup ${rollupId} already published, skipping`);
      await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
      return;
    }
    if (rollupRow.status !== "draft") {
      throw new Error(`Rollup ${rollupId} is not reviewable (status: ${rollupRow.status})`);
    }

    // Source ground truth = published/flagged daily archives in the rollup's period
    // (2026-08-07: flagged included — same rationale as executeRollupWeek).
    const sourceArchives = await db.select().from(aiLabArchives).where(
      and(
        inArray(aiLabArchives.status, ["published", "flagged"]),
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

  // ── Call Quality Checker via Groq (gpt-oss-20b) ──────────────────────
  // 2026-08-07: GitHub Models retired → migrated from openai/gpt-4o-mini.
  // gpt-oss-20b is faster than the QC's default gpt-oss-120b and JSON mode is
  // verified live; keeps load off the 120b TPM pool (participants + theme setter).
  const rawResponse = await callAgent(
    { ...agent, provider: "groq", model: "openai/gpt-oss-20b" } as Parameters<typeof callAgent>[0],
    prompt,
    { jsonMode: true, maxTokens: 400, temperature: 0.1 }
  );

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
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
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

  // ── 1. Fetch published/flagged daily archives in the period ─────────
  // 2026-08-07: include flagged archives too. The QC has flagged every daily
  // archive since 2026-06-10 (quote-fidelity nits) — requiring 'published'
  // made weekly rollups silently skip every week. Flagged archives are still
  // valid content records; the rollup is a synthesis and has its own QC pass.
  const archives = await db.select().from(aiLabArchives).where(
    and(
      inArray(aiLabArchives.status, ["published", "flagged"]),
      gte(aiLabArchives.date, periodStart),
      lte(aiLabArchives.date, periodEnd)
    )
  ).orderBy(asc(aiLabArchives.date));

  if (archives.length === 0) {
    console.log(`[ai-lab] Weekly rollup ${periodStart}–${periodEnd}: no archives, skipping`);
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
  // jsonMode: true (gpt-oss-120b verified) — the old GitHub gpt-4o path repeatedly
  // produced invalid JSON for weekly rollups; native JSON enforcement removes that.
  const rawResponse = await callAgent(agent as Parameters<typeof callAgent>[0], prompt, {
    temperature: 0.7,
    jsonMode:    true,
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

  // ── 4. Insert rollup row as published ─────────────────────────────────
  // 2026-08-07: rollups published directly — QC approval gate removed.
  const title = `Week of ${periodStart} – ${periodEnd}`;
  const now = new Date();

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
      status:           "published",
      publishedAt:      now,
      generatedAt:      now,
    })
    .onConflictDoUpdate({
      target: [aiLabRollups.periodType, aiLabRollups.periodStart],
      set: {
        summaryMarkdown:  narrativeArc,
        narrativeArc,
        keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
        keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
        memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
        status:           "published",
        publishedAt:      now,
        generatedAt:      now,
      },
    })
    .returning({ id: aiLabRollups.id });

  console.log(`[ai-lab] Weekly rollup ${periodStart}–${periodEnd} published (id: ${newRollup?.id})`);

  // ── 5. Increment usage ───────────────────────────────────────────────
  await db
    .insert(aiUsage)
    .values({ agentId: agent.id, date: today, requestCount: 1, lastRequestAt: now, lastProvider: agent.provider })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
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
  // 2026-08-07: include flagged rollups (same rationale as executeRollupWeek —
  // QC flags everything; monthly must not starve).
  const weeklyRollups = await db.select().from(aiLabRollups).where(
    and(
      eq(aiLabRollups.periodType, "weekly"),
      inArray(aiLabRollups.status, ["published", "flagged"]),
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
        inArray(aiLabArchives.status, ["published", "flagged"]),
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
  // jsonMode: true (gpt-oss-120b verified) — native JSON enforcement.
  const rawResponse = await callAgent(agent as Parameters<typeof callAgent>[0], prompt, {
    temperature: 0.7,
    jsonMode:    true,
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

  // ── 5. Insert rollup row as published ─────────────────────────────────
  // 2026-08-07: rollups published directly — QC approval gate removed.
  const title = `Month of ${periodStart.slice(0, 7)}`;
  const now = new Date();

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
      status:           "published",
      publishedAt:      now,
      generatedAt:      now,
    })
    .onConflictDoUpdate({
      target: [aiLabRollups.periodType, aiLabRollups.periodStart],
      set: {
        summaryMarkdown:  narrativeArc,
        narrativeArc,
        keyDisagreements: (parsed.key_disagreements ?? []) as unknown as Record<string, unknown>[],
        keyQuestions:     (parsed.key_questions     ?? []) as unknown as string[],
        memorableQuotes:  (parsed.memorable_quotes  ?? []) as unknown as Record<string, unknown>[],
        status:           "published",
        publishedAt:      now,
        generatedAt:      now,
      },
    })
    .returning({ id: aiLabRollups.id });

  console.log(`[ai-lab] Monthly rollup ${periodStart.slice(0, 7)} published (id: ${newRollup?.id})`);

  // ── 6. Increment usage ───────────────────────────────────────────────
  await db
    .insert(aiUsage)
    .values({ agentId: agent.id, date: today, requestCount: 1, lastRequestAt: now, lastProvider: agent.provider })
    .onConflictDoUpdate({
      target: [aiUsage.agentId, aiUsage.date],
      targetWhere: sql`${aiUsage.agentId} IS NOT NULL AND ${aiUsage.date} IS NOT NULL`,
      set: { requestCount: sql`${aiUsage.requestCount} + 1`, lastRequestAt: now, lastProvider: agent.provider },
    });
}

// ─── Conductor writer ─────────────────────────────────────────────────
//
// Reads the full thread, asks the model to identify the sharpest unresolved
// tension, and writes it as a question. No QC review, no debate reply cascade,
// no usage upsert — the conductor asks a question, it doesn't make a claim.

async function writeConductorQuestion(agentId: string, item: AIQueue): Promise<void> {
  if (!item.targetIdeaId) throw new Error("conductor action missing targetIdeaId");

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, item.targetIdeaId)).limit(1);
  if (!idea) throw new Error(`Idea not found: ${item.targetIdeaId}`);

  const comments = await db
    .select({ userId: ideaComments.userId, content: ideaComments.content })
    .from(ideaComments)
    .where(eq(ideaComments.ideaId, item.targetIdeaId))
    .orderBy(asc(ideaComments.createdAt));

  if (comments.length < 2) {
    console.log(`[ai-lab] Conductor: fewer than 2 comments on idea ${item.targetIdeaId} — skipping`);
    return;
  }

  const threadText = comments
    .map((c) => `@${(c.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-")}: ${c.content}`)
    .join("\n\n");

  const userPrompt = `IDEA: "${idea.title}"
${idea.context ? `PITCH: ${idea.context}\n` : ""}
DEBATE THREAD:
${threadText}

---
Identify the sharpest unresolved tension and pose it as one direct question. Follow your Conductor rules exactly.`;

  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Conductor agent not found: ${agentId}`);

  const response = await callAgent(agent, userPrompt, { temperature: 0.5, maxTokens: 120 });
  const cleaned  = response.trim();

  if (!cleaned || cleaned.toUpperCase() === "SKIP") {
    console.log(`[ai-lab] Conductor: debate resolved for idea ${item.targetIdeaId} — SKIP`);
    return;
  }
  if (cleaned.length < 15) throw new Error("Conductor response too short to be a valid question");

  const [newComment] = await db
    .insert(ideaComments)
    .values({ ideaId: item.targetIdeaId, userId: agentId, content: cleaned, parentId: null })
    .returning({ id: ideaComments.id });

  if (newComment) {
    await db
      .update(ideas)
      .set({ totalComments: sql`${ideas.totalComments} + 1` })
      .where(eq(ideas.id, item.targetIdeaId));

    await db.update(aiQueue).set({ resultCommentId: newComment.id }).where(eq(aiQueue.id, item.id));
  }

  console.log(`[ai-lab] Conductor posted question for idea ${item.targetIdeaId}`);
}

// ─── AI Lab "Debate of the Day" ───────────────────────────────────────
//
// Autonomous counterpart to Quick Debate: queued once daily by
// queueAILabDebateOfDay() for the day's most contested idea. No human
// submitted this, so there's no needs_clarification path — the Judge only
// picks the sharpest pairing and mode, then both agents post a tight,
// adversarial two-turn exchange as comments on the idea itself.

async function executeAILabDebate(
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

    try {
      await queueCommentsOnIdea(newIdea.id, agentId);
    } catch (err) {
      console.error(
        `[executor] queueCommentsOnIdea failed for lab discussion ${newIdea.id}:`,
        (err as Error).message
      );
    }
    try {
      await queueQualityReview(newIdea.id, "idea");
    } catch (err) {
      console.error(
        `[executor] queueQualityReview failed for lab discussion ${newIdea.id}:`,
        (err as Error).message
      );
    }
  }
}

// ─── Quick Debate handlers ────────────────────────────────────────────
//
// Three self-contained handlers for the Quick Debate flow. All bypass the
// generic buildPrompt/callAgent path and manage their own LLM calls and
// usage tracking.
//
// Flow: quick_debate_seed → quick_debate_reply → quick_debate_archive
//   seed:    Llama posts reply, queues GPT-OSS reply and archive jobs
//   reply:   GPT-OSS posts reply in response to Llama
//   archive: Gates on ≥2 agent replies; reschedules if not met (max 3 retries)
//            then calls Archivist to produce the narrative and marks debate complete

// MAX_ARCHIVE_RETRIES: number of times the archive job reschedules before giving up
const MAX_ARCHIVE_RETRIES = 3;

async function executeQuickDebateSeed(
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

async function executeQuickDebateReply(
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

async function executeQuickDebateArchive(
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

// ─── DEBATE_TURN ──────────────────────────────────────────────────────────────
// Chains: debate_turn (slot 0) → debate_turn (slot 1) → debate_archive
// Handles both round 1 and round 2. round defaults to 1 for legacy queue items.
async function executeDebateTurn(
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

  if (round === 2) {
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
    const archivistAgent = getAgent("ai_archivist");
    if (!archivistAgent) throw new Error("debate_turn: ai_archivist agent not found");

    await db.insert(aiQueue).values({
      agentId:       archivistAgent.id,
      actionType:    "debate_archive",
      promptContext: { debateId, round },
      priority:      1,
      scheduledFor:  new Date(),
      status:        "pending",
    });
  }

  await db.update(aiQueue).set({ status: "completed" }).where(eq(aiQueue.id, item.id));
}

// ─── DEBATE_ARCHIVE ───────────────────────────────────────────────────────────
// Round 1: generates crux summary, sets status=archived, shareToken.
// Round 2: generates verdict_reasoning + verdict JSON, preserves archivistSummary.
async function executeDebateArchive(item: AIQueue): Promise<void> {
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
