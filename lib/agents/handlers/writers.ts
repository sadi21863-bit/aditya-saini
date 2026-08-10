import { db } from "@/db";
import {
  aiThemes, ideas, ideaComments, aiModerationLog, aiQueue, notifications,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAgent } from "../personas";
import { callAgent } from "../providers/index";
import { queueCommentsOnIdea, queueConductorIntervention, queueQualityReview, queueDebateReply } from "../scheduler";
import { parseJsonResponse } from "../json-helpers";
import type { AIQueue } from "@/db/schema";
import { AI_LAB_ROOM_ID, MIN_CONTENT_LENGTH } from "./shared";

export async function writeThemeSelect(
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

export async function writePostIdea(
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

export async function writeComment(
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

export async function writeQualityReview(
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

/**
 * Writes an AI response to a human @mention — comment goes in the ORIGINAL room,
 * not the AI Lab room.  Sends a notification to the mentioning user.
 */
export async function writeMentionResponse(
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
export async function writeLabDiscussion(
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

// ─── Conductor writer ─────────────────────────────────────────────────
//
// Reads the full thread, asks the model to identify the sharpest unresolved
// tension, and writes it as a question. No QC review, no debate reply cascade,
// no usage upsert — the conductor asks a question, it doesn't make a claim.

export async function writeConductorQuestion(agentId: string, item: AIQueue): Promise<void> {
  if (!item.targetIdeaId) throw new Error("conductor action missing targetIdeaId");

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, item.targetIdeaId)).limit(1);
  if (!idea) throw new Error(`Idea not found: ${item.targetIdeaId}`);

  const comments = await db
    .select({ userId: ideaComments.userId, content: ideaComments.content })
    .from(ideaComments)
    .where(eq(ideaComments.ideaId, item.targetIdeaId))
    .orderBy(sql`${ideaComments.createdAt} ASC`);

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
