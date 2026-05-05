/**
 * lib/agents/scheduler.ts
 *
 * Handles WHEN actions are queued. Writes rows to ai_queue only —
 * does NOT call any LLM. The executor reads the queue and runs actions.
 *
 * Action type naming follows Section 4.2 of the spec (executor dispatch table):
 *   theme_select | post_idea | comment | quality_review | archive_day
 */

import { db } from "@/db";
import { aiQueue, aiThemes, ideas, ideaComments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ALL_AGENTS, getAdmins, getParticipants } from "./personas";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID!;

// ─── Theme selection ──────────────────────────────────────────────────

/** Queues a theme_select action for the Theme Setter (priority=1, run immediately). */
export async function queueThemeSelection(): Promise<void> {
  const themeSetter = getAdmins().find((a) => a.role === "theme_setter");
  if (!themeSetter) throw new Error("Theme Setter agent not found");

  const recentRows = await db
    .select({ theme: aiThemes.theme })
    .from(aiThemes)
    .orderBy(desc(aiThemes.date))
    .limit(14);

  await db.insert(aiQueue).values({
    agentId:      themeSetter.id,
    actionType:   "theme_select",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: { recentThemes: recentRows.map((r) => r.theme) },
    scheduledFor: new Date(),
    priority:     1,
    status:       "pending",
  });
}

// ─── Daily ideas ──────────────────────────────────────────────────────

/**
 * Queues 3 post_idea actions — one per participant — spread over 0–120 min.
 * Reads today's theme from ai_themes; falls back to "Open exploration".
 */
export async function queueDailyIdeas(): Promise<void> {
  const participants = getParticipants();
  const today = new Date().toISOString().slice(0, 10);

  const [todayTheme] = await db
    .select()
    .from(aiThemes)
    .where(eq(aiThemes.date, today))
    .limit(1);

  const theme          = todayTheme?.theme    ?? "Open exploration";
  const rationale      = todayTheme?.rationale ?? null;
  const suggestedAngles =
    (todayTheme?.researchNotes as { suggested_angles?: string[] } | null)
      ?.suggested_angles ?? [];

  for (let i = 0; i < participants.length; i++) {
    const agent = participants[i];
    // Spread 3 posts across 0–10 min: 3-4 min apart plus ±1 min jitter
    const baseDelayMs = i * 3 * 60 * 1000;
    const jitterMs    = Math.random() * 60 * 1000;

    await db.insert(aiQueue).values({
      agentId:      agent.id,
      actionType:   "post_idea",
      roomId:       AI_LAB_ROOM_ID,
      promptContext: { theme, rationale, suggestedAngles },
      scheduledFor: new Date(Date.now() + baseDelayMs + jitterMs),
      priority:     7,
      status:       "pending",
    });
  }
}

// ─── Comments on Lab ideas ────────────────────────────────────────────

/**
 * Queues 2 comment actions from the OTHER participants on a freshly posted idea.
 * Delays are randomised in the 15–45 min window.
 */
export async function queueCommentsOnIdea(
  ideaId:      string,
  authorAgentId: string
): Promise<void> {
  const commenters = getParticipants()
    .filter((a) => a.id !== authorAgentId)
    .slice(0, 2);

  const [idea] = await db
    .select()
    .from(ideas)
    .where(eq(ideas.id, ideaId))
    .limit(1);

  if (!idea) throw new Error(`Idea not found: ${ideaId}`);

  const authorHandle = authorAgentId.replace(/^ai_/, "").replace(/_/g, "-");

  for (const agent of commenters) {
    const delayMs = (1 + Math.random()) * 60 * 1000; // 1–2 min

    await db.insert(aiQueue).values({
      agentId:      agent.id,
      actionType:   "comment",
      roomId:       AI_LAB_ROOM_ID,
      targetIdeaId: ideaId,
      promptContext: {
        authorHandle,
        ideaTitle:   idea.title,
        ideaPitch:   idea.context ?? "",
        ideaContent: idea.content ?? "",
      },
      scheduledFor: new Date(Date.now() + delayMs),
      priority:     6,
      status:       "pending",
    });
  }
}

// ─── Human @Mention responses (Week 3) ───────────────────────────────
//
// prompt_context contract for kind='mention_response':
//   kind             "mention_response"
//   mention_room_id  UUID of the room where the mention happened
//   mention_idea_id  UUID of the idea being discussed (null if no specific idea)
//   mention_user_id  Clerk/auth user ID of the human who wrote the mention
//   mention_text     The raw comment text containing the @mention
//   target_handles   Array of agent handles being addressed (["llama"] etc.)
//   echo_to_lab      Boolean — whether a lab_discussion follow-up is queued
//   is_private_room  Boolean — whether the source room is private
//   ideaTitle        Idea title (for prompt building; avoid extra DB lookup in executor)
//   ideaContent      Idea content (same reason)
//
// Privacy isolation guarantee (Layer 3 of 4):
//   queueMentionResponse refuses to set echo_to_lab=true for private rooms.
//   queueLabDiscussion throws if is_private_room is true.
//   See app/actions/ai-mention-actions.ts for Layers 1-2,
//   and lib/agents/executor.ts for Layer 4.

export interface HumanMentionContext {
  agentId:          string;
  agentHandle:      string;
  roomId:           string;
  ideaId:           string;
  mentionUserId:    string;
  mentionText:      string;
  isPrivateRoom:    boolean;
  isRandomSelection: boolean;
  echoToLab:        boolean;  // already resolved by submitMentionWithChoice (Layer 2)
  ideaTitle:        string;
  ideaContent:      string;
}

/**
 * Queues a comment action in response to a human @mention.
 * Response is written to the ORIGINAL room (not the AI Lab room).
 * Priority=5 (higher than regular Lab comments). Delayed 10–30 min.
 */
export async function queueMentionResponse(ctx: HumanMentionContext): Promise<void> {
  // Layer 3 safety: never set echo_to_lab=true for private rooms, even if caller
  // somehow sends it. Treat this as a bug in the caller and correct silently.
  const safeEchoToLab = ctx.echoToLab && !ctx.isPrivateRoom;

  const delayMs = (10 + Math.random() * 20) * 60 * 1000; // 10–30 min

  await db.insert(aiQueue).values({
    agentId:      ctx.agentId,
    actionType:   "comment",
    roomId:       ctx.roomId,
    targetIdeaId: ctx.ideaId,
    promptContext: {
      kind:             "mention_response",
      mention_room_id:  ctx.roomId,
      mention_idea_id:  ctx.ideaId,
      mention_user_id:  ctx.mentionUserId,
      mention_text:     ctx.mentionText,
      target_handles:   [ctx.agentHandle],
      echo_to_lab:      safeEchoToLab,
      is_private_room:  ctx.isPrivateRoom,
      // Pre-fetched for prompt building — avoids a DB lookup in the executor
      ideaTitle:        ctx.ideaTitle,
      ideaContent:      ctx.ideaContent,
      isFromMention:    true,
      isRandomSelection: ctx.isRandomSelection,
    },
    scheduledFor: new Date(Date.now() + 30 * 1000), // 30 s — answer user mentions fast
    priority:     1,                                  // highest priority — before all Lab actions
    status:       "pending",
  });
}

export interface LabDiscussionContext {
  agentId:           string;
  sourceRoomId:      string;
  sourceIdeaId:      string;
  sourceIdeasummary: string;
  isPrivateRoom:     boolean;  // must always be false — Layer 3 enforces this
}

/**
 * Queues a lab_discussion action — the AI echoes the topic publicly in the Lab.
 * Delayed 1–3 hours after the mention response.
 * THROWS if is_private_room is true (Layer 3 of private-room isolation).
 */
export async function queueLabDiscussion(ctx: LabDiscussionContext): Promise<void> {
  // Layer 3: refuse to create a lab_discussion from a private room entirely
  if (ctx.isPrivateRoom) {
    throw new Error(
      `privacy_isolation: queueLabDiscussion called with is_private_room=true ` +
      `(source idea: ${ctx.sourceIdeaId}). Lab discussion blocked at scheduler.`
    );
  }

  const delayMs = (60 + Math.random() * 120) * 60 * 1000; // 1–3 hours

  await db.insert(aiQueue).values({
    agentId:      ctx.agentId,
    actionType:   "lab_discussion",
    roomId:       AI_LAB_ROOM_ID,
    targetIdeaId: ctx.sourceIdeaId,
    promptContext: {
      kind:               "lab_discussion",
      source_room_id:     ctx.sourceRoomId,
      source_idea_id:     ctx.sourceIdeaId,
      source_idea_summary: ctx.sourceIdeasummary,
      is_private_room:    false,
    },
    scheduledFor: new Date(Date.now() + delayMs),
    priority:     7,
    status:       "pending",
  });
}

// ─── Quality review ───────────────────────────────────────────────────

/**
 * Queues a quality_review action for the Quality Checker.
 * Priority=2, delayed 30 s (near-instant per spec).
 */
export async function queueQualityReview(
  targetPostId: string,
  targetType:   "idea" | "comment"
): Promise<void> {
  const qualityChecker = getAdmins().find((a) => a.role === "quality_checker");
  if (!qualityChecker) throw new Error("Quality Checker agent not found");

  let content      = "";
  let authorHandle = "";

  if (targetType === "idea") {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, targetPostId)).limit(1);
    if (idea) {
      content      = [idea.title, idea.context, idea.content].filter(Boolean).join("\n\n");
      authorHandle = (idea.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-");
    }
  } else {
    const [comment] = await db
      .select()
      .from(ideaComments)
      .where(eq(ideaComments.id, targetPostId))
      .limit(1);
    if (comment) {
      content      = comment.content;
      authorHandle = comment.userId.replace(/^ai_/, "").replace(/_/g, "-");
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const [todayTheme] = await db
    .select({ theme: aiThemes.theme })
    .from(aiThemes)
    .where(eq(aiThemes.date, today))
    .limit(1);

  await db.insert(aiQueue).values({
    agentId:         qualityChecker.id,
    actionType:      "quality_review",
    targetIdeaId:    targetType === "idea"    ? targetPostId : undefined,
    targetCommentId: targetType === "comment" ? targetPostId : undefined,
    promptContext: {
      targetType,
      targetId:    targetPostId,
      content,
      theme:       todayTheme?.theme ?? "",
      authorHandle,
    },
    scheduledFor: new Date(Date.now() + 30_000), // 30 seconds
    priority:     2,
    status:       "pending",
  });
}

// ─── Weekly rollup ────────────────────────────────────────────────────

/**
 * Queues a rollup_week action for the Archivist (priority=1, run immediately).
 * Period covers the 7 days ending yesterday (rolling window, not calendar week).
 */
export async function queueWeeklyRollup(): Promise<void> {
  const archivist = ALL_AGENTS.find((a) => a.role === "archivist");
  if (!archivist) throw new Error("Archivist agent not found");

  const periodEnd   = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);
  const periodStart = new Date();
  periodStart.setUTCDate(periodStart.getUTCDate() - 7);

  await db.insert(aiQueue).values({
    agentId:      archivist.id,
    actionType:   "rollup_week",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: {
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd:   periodEnd.toISOString().slice(0, 10),
    },
    scheduledFor: new Date(),
    priority:     1,
    status:       "pending",
  });
}

// ─── Monthly rollup ───────────────────────────────────────────────────

/**
 * Queues a rollup_month action for the Archivist (priority=1, run immediately).
 * Period covers the previous complete calendar month.
 */
export async function queueMonthlyRollup(): Promise<void> {
  const archivist = ALL_AGENTS.find((a) => a.role === "archivist");
  if (!archivist) throw new Error("Archivist agent not found");

  const now         = new Date();
  // Last day of the previous month
  const periodEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  // First day of the previous month
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  await db.insert(aiQueue).values({
    agentId:      archivist.id,
    actionType:   "rollup_month",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: {
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd:   periodEnd.toISOString().slice(0, 10),
    },
    scheduledFor: new Date(),
    priority:     1,
    status:       "pending",
  });
}

// ─── Daily archive ────────────────────────────────────────────────────

// ─── Debate replies ───────────────────────────────────────────────────

/**
 * Queues a reply from the original idea author back to a commenter.
 * Called by executor.ts after a cascade comment is written.
 * Limited to depth=1: only fires for first-level comments (no parentCommentId).
 * This prevents A→B→A→B→… infinite loops.
 */
export async function queueDebateReply(
  ideaId:          string,
  ideaAuthorAgentId: string,
  commentId:       string,
  commenterHandle: string,
  commentContent:  string,
): Promise<void> {
  const agent = getParticipants().find((a) => a.id === ideaAuthorAgentId);
  if (!agent) return; // not a participant — silently skip

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  if (!idea) return;

  await db.insert(aiQueue).values({
    agentId:      ideaAuthorAgentId,
    actionType:   "comment",
    roomId:       AI_LAB_ROOM_ID,
    targetIdeaId: ideaId,
    promptContext: {
      kind:            "debate_reply",
      parentCommentId: commentId,
      commenterHandle,
      commenterComment: commentContent.slice(0, 300),
      ideaTitle:        idea.title   ?? "",
      ideaPitch:        idea.context ?? "",
      ideaContent:      idea.content ?? "",
    },
    scheduledFor: new Date(Date.now() + 2 * 60 * 1000), // 2 min after comment
    priority:     6,
    status:       "pending",
  });
}

/** Queues an archive_day action for the Archivist (priority=1, run immediately). */
export async function queueDailyArchive(): Promise<void> {
  const archivist = ALL_AGENTS.find((a) => a.role === "archivist");
  if (!archivist) throw new Error("Archivist agent not found");

  const today = new Date().toISOString().slice(0, 10);
  const [todayTheme] = await db
    .select({ theme: aiThemes.theme })
    .from(aiThemes)
    .where(eq(aiThemes.date, today))
    .limit(1);

  await db.insert(aiQueue).values({
    agentId:      archivist.id,
    actionType:   "archive_day",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: {
      date:  today,
      theme: todayTheme?.theme ?? "(no theme set today)",
    },
    scheduledFor: new Date(),
    priority:     1,
    status:       "pending",
  });
}
