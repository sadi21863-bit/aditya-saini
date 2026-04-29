/**
 * app/actions/ai-mention-actions.ts
 *
 * Server-side logic for handling human @mention submissions.
 * Implements Layers 1-2 of the 4-layer private-room isolation guarantee:
 *
 *   Layer 1 (UI)        — TODO Week 5: disable "Answer AND discuss in AI Lab"
 *                         radio when room.visibility === 'private'. Leave the
 *                         option visible but greyed-out with text:
 *                         "Private rooms always stay private."
 *
 *   Layer 2 (here)      — Force echoChoice='private' server-side if room is
 *                         private, regardless of what the client sends.
 *                         Logs the override to ai_moderation_log.
 *
 *   Layer 3 (scheduler) — queueLabDiscussion throws if is_private_room=true.
 *
 *   Layer 4 (executor)  — writeLabDiscussion refuses if is_private_room=true
 *                         in prompt_context and logs to ai_moderation_log.
 *
 * Privacy isolation events are logged to ai_moderation_log with
 * verdict='isolated' and moderator_agent_id='system'.
 * target_type='mention' for server-action overrides (Layer 2).
 * target_type='queue_action' for executor refusals (Layer 4).
 */

import { db } from "@/db";
import { rooms, ideas, ideaComments, aiModerationLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { extractAIMentions } from "@/lib/agents/mentions";
import { checkUserMentionRateLimit } from "@/lib/agents/user-rate-limit";
import { queueMentionResponse, queueLabDiscussion } from "@/lib/agents/scheduler";

export interface MentionInput {
  roomId:           string;
  ideaId:           string;        // required — comment must attach to an idea
  parentCommentId?: string;        // for threaded replies
  content:          string;
  echoChoice:       "private" | "public";
}

export interface MentionResult {
  success:         boolean;
  queued:          number;
  mentionedAgents: string[];
  error?:          string;
  resetAt?:        Date;
}

export async function submitMentionWithChoice(
  input: MentionInput
): Promise<MentionResult> {
  // ── Auth ───────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { success: false, queued: 0, mentionedAgents: [], error: "unauthenticated" };
  }

  // ── Detect mentions ────────────────────────────────────────────────
  const mentions = await extractAIMentions(input.content);
  if (mentions.length === 0) {
    return { success: false, queued: 0, mentionedAgents: [], error: "no_ai_mentions_found" };
  }

  // ── Load room ─────────────────────────────────────────────────────
  const [room] = await db
    .select({ visibility: rooms.visibility, isAiLab: rooms.isAiLab })
    .from(rooms)
    .where(eq(rooms.id, input.roomId))
    .limit(1);

  if (!room) {
    return { success: false, queued: 0, mentionedAgents: [], error: "room_not_found" };
  }

  const isPrivateRoom = room.visibility === "private";

  // ── Layer 2: force private echo choice if room is private ─────────
  let resolvedEcho = input.echoChoice;
  if (isPrivateRoom && resolvedEcho === "public") {
    resolvedEcho = "private";

    // Audit log — target_id is the idea where the mention happened
    await db.insert(aiModerationLog).values({
      moderatorAgentId: "system",
      targetType:       "mention",
      targetId:         input.ideaId,
      verdict:          "isolated",
      reason:           "Private room: echo to Lab blocked by server action.",
      reviewedAt:       new Date(),
    }).catch((e) =>
      console.error("[ai-lab] Failed to write Layer-2 isolation log:", (e as Error).message)
    );
  }

  const echoToLab = resolvedEcho === "public" && !isPrivateRoom;

  // ── Rate limit ────────────────────────────────────────────────────
  const rateLimit = await checkUserMentionRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      success:        false,
      queued:         0,
      mentionedAgents: [],
      error:          "rate_limit_exceeded",
      resetAt:        rateLimit.resetAt,
    };
  }

  // ── Load idea for context ─────────────────────────────────────────
  const [idea] = await db
    .select({ title: ideas.title, content: ideas.content, userId: ideas.userId })
    .from(ideas)
    .where(eq(ideas.id, input.ideaId))
    .limit(1);

  // ── Step d: write the user's comment to the DB ────────────────────
  // This happens regardless of whether mentions are processable.
  const [newComment] = await db
    .insert(ideaComments)
    .values({
      ideaId:   input.ideaId,
      userId,
      content:  input.content,
      parentId: input.parentCommentId ?? null,
    })
    .returning({ id: ideaComments.id });

  // ── Step e: queue mention_response for each resolved agent ────────
  let queued = 0;
  const mentionedAgents: string[] = [];

  for (const mention of mentions) {
    await queueMentionResponse({
      agentId:          mention.agentId,
      agentHandle:      mention.agentHandle,
      roomId:           input.roomId,
      ideaId:           input.ideaId,
      mentionUserId:    userId,
      mentionText:      input.content,
      isPrivateRoom,
      isRandomSelection: mention.isRandomSelection,
      echoToLab,
      ideaTitle:   idea?.title   ?? "",
      ideaContent: idea?.content ?? "",
    });
    queued++;
    mentionedAgents.push(mention.agentHandle);

    // ── Step f: queue lab_discussion if echoToLab ──────────────────
    // Layer 3 is inside queueLabDiscussion — throws if is_private_room=true
    if (echoToLab) {
      const summary = idea?.title
        ? `A user raised the topic: "${idea.title.slice(0, 100)}"`
        : "A user raised a topic for discussion.";

      await queueLabDiscussion({
        agentId:           mention.agentId,
        sourceRoomId:      input.roomId,
        sourceIdeaId:      input.ideaId,
        sourceIdeasummary: summary,
        isPrivateRoom:     false,  // safe — echoToLab is only true when !isPrivateRoom
      });
    }
  }

  return { success: true, queued, mentionedAgents };
}
