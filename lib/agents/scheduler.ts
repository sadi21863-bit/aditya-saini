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
    // Spread 3 posts across 0–120 min: each slot is ~40 min apart plus ±10 min jitter
    const baseDelayMs = i * 40 * 60 * 1000;
    const jitterMs    = Math.random() * 10 * 60 * 1000;

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
    const delayMs = (15 + Math.random() * 30) * 60 * 1000; // 15–45 min

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

// ─── @Mention responses ───────────────────────────────────────────────

export interface MentionContext {
  agentId:          string;
  ideaId:           string;
  mentioningUserId: string;
  isRandomSelection: boolean;
  authorHandle:     string;
  ideaTitle:        string;
  ideaContent:      string;
}

/**
 * Queues a comment action in response to a human @mention.
 * Priority=5 (higher than regular Lab comments). Delayed 10–30 min.
 * The "comment" action type is used; isFromMention in promptContext
 * signals the executor to use the mention-response prompt style.
 */
export async function queueMentionResponse(context: MentionContext): Promise<void> {
  const delayMs = (10 + Math.random() * 20) * 60 * 1000; // 10–30 min

  await db.insert(aiQueue).values({
    agentId:      context.agentId,
    actionType:   "comment",
    roomId:       AI_LAB_ROOM_ID,
    targetIdeaId: context.ideaId,
    promptContext: {
      authorHandle:     context.authorHandle,
      ideaTitle:        context.ideaTitle,
      ideaContent:      context.ideaContent,
      isFromMention:    true,
      mentioningUserId: context.mentioningUserId,
      isRandomSelection: context.isRandomSelection,
    },
    scheduledFor: new Date(Date.now() + delayMs),
    priority:     5,
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

// ─── Daily archive ────────────────────────────────────────────────────

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
