"use server";

import { db } from "@/db";
import { ideaComments, communityComments, ideas, communityIdeas, users } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth";
import { XP_EVENTS } from "@/lib/tier-engine";
import { z } from "zod";
import { createNotification } from "./notificationActions";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";
import { awardXp } from "@/lib/xp";

// ─── VAULT IDEA COMMENTS (ideaComments table) ─────────────────────────────────

export async function addComment(
  ideaId: string,
  content: string,
  parentId?: string
) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const trimmed = content?.trim();
  if (!trimmed) return { success: false, error: "Comment cannot be empty" };
  if (trimmed.length > 1000) return { success: false, error: "Too long" };

  // Verify the vault idea exists and is published
  const [idea] = await db
    .select({ id: ideas.id, userId: ideas.userId, title: ideas.title, totalComments: ideas.totalComments })
    .from(ideas)
    .where(and(eq(ideas.id, ideaId), eq(ideas.status, "published")));
  if (!idea) return { success: false, error: "Idea not found or not published" };

  await db.insert(ideaComments).values({
    ideaId,
    userId: callerId,
    content: trimmed,
    parentId: parentId ?? null,
  });

  // Increment comment count on idea
  await db
    .update(ideas)
    .set({ totalComments: sql`${ideas.totalComments} + 1`, updatedAt: new Date() })
    .where(eq(ideas.id, ideaId));

  // Award XP to idea owner and notify them
  if (idea.userId && idea.userId !== callerId) {
    await awardXp(idea.userId, XP_EVENTS.RECEIVE_COMMENT ?? 10);
    await createNotification({
      userId: idea.userId,
      type: "comment",
      body: `Someone commented on your idea "${idea.title}"`,
      link: `/idea/${ideaId}`,
    });
  }

  revalidatePath(`/idea/${ideaId}`);
  return { success: true };
}

export async function deleteComment(commentId: string, ideaId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await lightLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const [comment] = await db
    .select({ userId: ideaComments.userId })
    .from(ideaComments)
    .where(eq(ideaComments.id, commentId));
  if (!comment) return { success: false, error: "Not found" };
  if (comment.userId !== callerId) return { success: false, error: "Forbidden" };

  await db.delete(ideaComments).where(eq(ideaComments.id, commentId));

  // Decrement comment count
  await db
    .update(ideas)
    .set({ totalComments: sql`GREATEST(${ideas.totalComments} - 1, 0)`, updatedAt: new Date() })
    .where(eq(ideas.id, ideaId));

  revalidatePath(`/idea/${ideaId}`);
  return { success: true };
}

export async function getComments(ideaId: string) {
  const rows = await db
    .select({
      id: ideaComments.id,
      content: ideaComments.content,
      createdAt: ideaComments.createdAt,
      parentId: ideaComments.parentId,
      userId: ideaComments.userId,
      userName: users.name,
      userHandle: users.handle,
      userImage: users.image,
      userTier: users.tier,
      userXp: users.xp,
    })
    .from(ideaComments)
    .leftJoin(users, eq(ideaComments.userId, users.id))
    .where(eq(ideaComments.ideaId, ideaId))
    .orderBy(desc(ideaComments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
    parentId: r.parentId,
    user: {
      id: r.userId,
      name: r.userName,
      handle: r.userHandle,
      image: r.userImage,
      tier: r.userTier,
      xp: r.userXp ?? 0,
    },
  }));
}

// ─── COMMONS IDEA COMMENTS (communityComments table) ──────────────────────────

export async function addCommunityComment(
  communityIdeaId: string,
  content: string,
  parentId?: string
) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const trimmed = content?.trim();
  if (!trimmed) return { success: false, error: "Comment cannot be empty" };
  if (trimmed.length > 1000) return { success: false, error: "Too long" };

  const [idea] = await db
    .select({
      id: communityIdeas.id,
      userId: communityIdeas.userId,
      title: communityIdeas.title,
      totalComments: communityIdeas.totalComments,
    })
    .from(communityIdeas)
    .where(and(eq(communityIdeas.id, communityIdeaId), eq(communityIdeas.status, "published")));
  if (!idea) return { success: false, error: "Idea not found or not published" };

  await db.insert(communityComments).values({
    communityIdeaId,
    userId: callerId,
    content: trimmed,
    parentId: parentId ?? null,
  });

  await db
    .update(communityIdeas)
    .set({ totalComments: sql`${communityIdeas.totalComments} + 1`, updatedAt: new Date() })
    .where(eq(communityIdeas.id, communityIdeaId));

  if (idea.userId && idea.userId !== callerId) {
    await awardXp(idea.userId, XP_EVENTS.RECEIVE_COMMENT ?? 10);
    await createNotification({
      userId: idea.userId,
      type: "comment",
      body: `Someone commented on your Commons idea "${idea.title}"`,
      link: `/idea/${communityIdeaId}`,
    });
  }

  revalidatePath(`/idea/${communityIdeaId}`);
  return { success: true };
}

export async function deleteCommunityComment(
  commentId: string,
  communityIdeaId: string
) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await lightLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const [comment] = await db
    .select({ userId: communityComments.userId })
    .from(communityComments)
    .where(eq(communityComments.id, commentId));
  if (!comment) return { success: false, error: "Not found" };
  if (comment.userId !== callerId) return { success: false, error: "Forbidden" };

  await db.delete(communityComments).where(eq(communityComments.id, commentId));

  await db
    .update(communityIdeas)
    .set({
      totalComments: sql`GREATEST(${communityIdeas.totalComments} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(communityIdeas.id, communityIdeaId));

  revalidatePath(`/idea/${communityIdeaId}`);
  return { success: true };
}

export async function getCommunityComments(communityIdeaId: string) {
  const rows = await db
    .select({
      id: communityComments.id,
      content: communityComments.content,
      createdAt: communityComments.createdAt,
      parentId: communityComments.parentId,
      userId: communityComments.userId,
      userName: users.name,
      userHandle: users.handle,
      userImage: users.image,
      userTier: users.tier,
      userXp: users.xp,
    })
    .from(communityComments)
    .leftJoin(users, eq(communityComments.userId, users.id))
    .where(eq(communityComments.communityIdeaId, communityIdeaId))
    .orderBy(desc(communityComments.createdAt));

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
    parentId: r.parentId,
    user: {
      id: r.userId,
      name: r.userName,
      handle: r.userHandle,
      image: r.userImage,
      tier: r.userTier,
      xp: r.userXp ?? 0,
    },
  }));
}
