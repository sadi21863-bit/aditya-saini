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
import { aiQueue, aiThemes, ideas, ideaComments, searchCache } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { ALL_AGENTS, getAdmins, getParticipants } from "./personas";
import { getThemeQuery } from "./research";

const AI_LAB_ROOM_ID = process.env.AI_LAB_ROOM_ID!;

// ─── promptContext Zod schemas ─────────────────────────────────────────────
// One schema per action type. Validated before every db.insert(aiQueue) call.
// If validation fails the queue row is NOT written and the error is logged.

const ThemeResearchContext = z.object({
  date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  query: z.string().min(1).max(300),
});

const SourceCitationSchema = z.object({
  title:       z.string(),
  summary:     z.string(),
  publishedAt: z.string(),
  source:      z.string(),
  url:         z.string(),
});

const ThemeSelectContext = z.object({
  recentThemes:    z.array(z.string()),
  researchContext: z.array(SourceCitationSchema).max(10).optional(),
});

const PostIdeaContext = z.object({
  theme:           z.string().min(1),
  rationale:       z.string().nullable(),
  suggestedAngles: z.array(z.string()),
});

const LabCommentContext = z.object({
  authorHandle: z.string().min(1),
  ideaTitle:    z.string(),
  ideaPitch:    z.string(),
  ideaContent:  z.string(),
});

const MentionResponseContext = z.object({
  kind:              z.literal("mention_response"),
  mention_room_id:   z.string().min(1),
  mention_idea_id:   z.string().nullable(),
  mention_user_id:   z.string().min(1),
  mention_text:      z.string().min(1),
  target_handles:    z.array(z.string()),
  echo_to_lab:       z.boolean(),
  is_private_room:   z.boolean(),
  ideaTitle:         z.string(),
  ideaContent:       z.string(),
  isFromMention:     z.boolean(),
  isRandomSelection: z.boolean(),
});

const DebateReplyContext = z.object({
  kind:             z.literal("debate_reply"),
  parentCommentId:  z.string().uuid(),
  commenterHandle:  z.string().min(1),
  commenterComment: z.string(),
  ideaTitle:        z.string(),
  ideaPitch:        z.string(),
  ideaContent:      z.string(),
});

const LabDiscussionCtxSchema = z.object({
  kind:                z.literal("lab_discussion"),
  source_room_id:      z.string().min(1),
  source_idea_id:      z.string().min(1),
  source_idea_summary: z.string(),
  is_private_room:     z.boolean(),
});

const QualityReviewContext = z.object({
  targetType:   z.enum(["idea", "comment"]),
  targetId:     z.string().min(1),
  content:      z.string().min(1),
  theme:        z.string(),
  authorHandle: z.string(),
});

const RollupContext = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ArchiveDayContext = z.object({
  date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.string(),
});

// ── Validation helper ──────────────────────────────────────────────────────
// Returns true if valid. Logs the error and returns false if invalid.
// Caller must return/continue early on false so no broken row is written.

function validateContext<T>(
  schema: z.ZodType<T>,
  data:   unknown,
  actionType: string
): data is T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(
      `[scheduler] Invalid promptContext for ${actionType}:`,
      result.error.flatten()
    );
    return false;
  }
  return true;
}

// ─── Theme research ───────────────────────────────────────────────────

/**
 * Queues a themeresearch action (priority 0 — runs before theme_select).
 * Idempotent: skips if today's research is already cached.
 */
export async function queueThemeResearch(date: string): Promise<void> {
  const query      = getThemeQuery();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));

  const existing = await db
    .select({ id: searchCache.id })
    .from(searchCache)
    .where(
      and(
        eq(searchCache.query, query),
        gte(searchCache.fetchedAt, startOfDay)
      )
    )
    .limit(1);

  if (existing.length) {
    console.log("[scheduler] Theme research already cached for today, skipping queue.");
    return;
  }

  const ctx_themeresearch = { date, query };
  if (!validateContext(ThemeResearchContext, ctx_themeresearch, "themeresearch")) return;

  await db.insert(aiQueue).values({
    agentId:      "ai_theme_setter",
    actionType:   "themeresearch",
    promptContext: ctx_themeresearch,
    scheduledFor:  new Date(),
    priority:      0, // higher than theme_select (priority 1) — must complete first
    status:        "pending",
  }).onConflictDoNothing();
}

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

  // Pull today's research from cache if available
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
  const researchRows = await db
    .select({ results: searchCache.results, source: searchCache.source })
    .from(searchCache)
    .where(gte(searchCache.fetchedAt, startOfDay))
    .orderBy(desc(searchCache.fetchedAt))
    .limit(1);

  const researchContext = researchRows[0]?.results ?? [];

  const ctx_themeselect = {
    recentThemes:    recentRows.map((r) => r.theme),
    researchContext,
  };
  if (!validateContext(ThemeSelectContext, ctx_themeselect, "theme_select")) return;

  await db.insert(aiQueue).values({
    agentId:      themeSetter.id,
    actionType:   "theme_select",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: ctx_themeselect,
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

    const ctx_postidea = { theme, rationale, suggestedAngles };
    if (!validateContext(PostIdeaContext, ctx_postidea, "post_idea")) continue;

    await db.insert(aiQueue).values({
      agentId:      agent.id,
      actionType:   "post_idea",
      roomId:       AI_LAB_ROOM_ID,
      promptContext: ctx_postidea,
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

    const ctx_labcomment = {
      authorHandle,
      ideaTitle:   idea.title,
      ideaPitch:   idea.context ?? "",
      ideaContent: idea.content ?? "",
    };
    if (!validateContext(LabCommentContext, ctx_labcomment, "comment:lab")) continue;

    await db.insert(aiQueue).values({
      agentId:      agent.id,
      actionType:   "comment",
      roomId:       AI_LAB_ROOM_ID,
      targetIdeaId: ideaId,
      promptContext: ctx_labcomment,
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

  const ctx_mention: z.infer<typeof MentionResponseContext> = {
    kind:              "mention_response",
    mention_room_id:   ctx.roomId,
    mention_idea_id:   ctx.ideaId,
    mention_user_id:   ctx.mentionUserId,
    mention_text:      ctx.mentionText,
    target_handles:    [ctx.agentHandle],
    echo_to_lab:       safeEchoToLab,
    is_private_room:   ctx.isPrivateRoom,
    ideaTitle:         ctx.ideaTitle,
    ideaContent:       ctx.ideaContent,
    isFromMention:     true,
    isRandomSelection: ctx.isRandomSelection,
  };
  if (!validateContext(MentionResponseContext, ctx_mention, "comment:mention_response")) return;

  await db.insert(aiQueue).values({
    agentId:      ctx.agentId,
    actionType:   "comment",
    roomId:       ctx.roomId,
    targetIdeaId: ctx.ideaId,
    promptContext: ctx_mention,
    scheduledFor: new Date(Date.now() + delayMs),
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

  const ctx_labdiscussion: z.infer<typeof LabDiscussionCtxSchema> = {
    kind:                "lab_discussion",
    source_room_id:      ctx.sourceRoomId,
    source_idea_id:      ctx.sourceIdeaId,
    source_idea_summary: ctx.sourceIdeasummary,
    is_private_room:     false,
  };
  if (!validateContext(LabDiscussionCtxSchema, ctx_labdiscussion, "lab_discussion")) return;

  await db.insert(aiQueue).values({
    agentId:      ctx.agentId,
    actionType:   "lab_discussion",
    roomId:       AI_LAB_ROOM_ID,
    targetIdeaId: ctx.sourceIdeaId,
    promptContext: ctx_labdiscussion,
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
      authorHandle = (comment.userId ?? "").replace(/^ai_/, "").replace(/_/g, "-");
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const [todayTheme] = await db
    .select({ theme: aiThemes.theme })
    .from(aiThemes)
    .where(eq(aiThemes.date, today))
    .limit(1);

  const ctx_qr = {
    targetType,
    targetId:    targetPostId,
    content,
    theme:       todayTheme?.theme ?? "",
    authorHandle,
  };
  if (!validateContext(QualityReviewContext, ctx_qr, "quality_review")) return;

  await db.insert(aiQueue).values({
    agentId:         qualityChecker.id,
    actionType:      "quality_review",
    targetIdeaId:    targetType === "idea"    ? targetPostId : undefined,
    targetCommentId: targetType === "comment" ? targetPostId : undefined,
    promptContext:   ctx_qr,
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

  const ctx_rollup = {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd:   periodEnd.toISOString().slice(0, 10),
  };
  if (!validateContext(RollupContext, ctx_rollup, "rollup_week")) return;

  await db.insert(aiQueue).values({
    agentId:      archivist.id,
    actionType:   "rollup_week",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: ctx_rollup,
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

  const ctx_rollup = {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd:   periodEnd.toISOString().slice(0, 10),
  };
  if (!validateContext(RollupContext, ctx_rollup, "rollup_month")) return;

  await db.insert(aiQueue).values({
    agentId:      archivist.id,
    actionType:   "rollup_month",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: ctx_rollup,
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

  const ctx_reply: z.infer<typeof DebateReplyContext> = {
    kind:             "debate_reply",
    parentCommentId:  commentId,
    commenterHandle,
    commenterComment: commentContent.slice(0, 300),
    ideaTitle:        idea.title   ?? "",
    ideaPitch:        idea.context ?? "",
    ideaContent:      idea.content ?? "",
  };
  if (!validateContext(DebateReplyContext, ctx_reply, "comment:debate_reply")) return;

  await db.insert(aiQueue).values({
    agentId:      ideaAuthorAgentId,
    actionType:   "comment",
    roomId:       AI_LAB_ROOM_ID,
    targetIdeaId: ideaId,
    promptContext: ctx_reply,
    scheduledFor: new Date(Date.now() + 2 * 60 * 1000), // 2 min after comment
    priority:     6,
    status:       "pending",
  });
}

/** Queues an archive_day action for the Archivist (priority=1, run immediately).
 *  Pass a date string (YYYY-MM-DD UTC) to archive a specific day; defaults to today. */
export async function queueDailyArchive(dateStr?: string): Promise<void> {
  const archivist = ALL_AGENTS.find((a) => a.role === "archivist");
  if (!archivist) throw new Error("Archivist agent not found");

  const today = dateStr ?? new Date().toISOString().slice(0, 10);
  const [todayTheme] = await db
    .select({ theme: aiThemes.theme })
    .from(aiThemes)
    .where(eq(aiThemes.date, today))
    .limit(1);

  const ctx_archive = {
    date:  today,
    theme: todayTheme?.theme ?? "(no theme set today)",
  };
  if (!validateContext(ArchiveDayContext, ctx_archive, "archive_day")) return;

  await db.insert(aiQueue).values({
    agentId:      archivist.id,
    actionType:   "archive_day",
    roomId:       AI_LAB_ROOM_ID,
    promptContext: ctx_archive,
    scheduledFor: new Date(),
    priority:     1,
    status:       "pending",
  });
}
