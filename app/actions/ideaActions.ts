"use server";

import { db } from "@/db";
import { ideas, ideaLikes, roomMembers } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";
import { createNotification } from "@/app/actions/notificationActions";

// ─── Validation ─────────────────────────────────────────────────────
const IdeaWriteSchema = z.object({
  title:       z.string().min(1).max(120),
  context:     z.string().max(280).optional().default(""),
  content:     z.string().min(1).max(10000),
  tags:        z.array(z.string().max(30)).max(10).optional().default([]),
  category:    z.string().max(50).optional(),
  roomId:      z.string().uuid(),
  feedVisible: z.boolean().optional().default(true),
});

// ─── Helpers ────────────────────────────────────────────────────────
async function assertOwnership(ideaId: string, callerId: string) {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) throw new Error("Idea not found");
  if (idea.userId !== callerId) throw new Error("Forbidden");
  return idea;
}

async function assertRoomMember(roomId: string, userId: string) {
  const [member] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  if (!member) throw new Error("Not a member of this room");
  return member;
}

// ─── CREATE ─────────────────────────────────────────────────────────
export async function addIdea(formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests"] } };

  const roomId = formData.get("roomId") as string;
  if (!roomId) return { success: false, errors: { form: ["Room ID is required"] } };

  // Must be a member of the room
  try { await assertRoomMember(roomId, callerId); } catch {
    return { success: false, errors: { form: ["You must be a member of this room"] } };
  }

  const parsedTags = typeof formData.get("tags") === "string"
    ? (formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean).slice(0, 10)
    : [];

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category") || undefined,
    context: formData.get("context"),
    content: formData.get("content"),
    tags: parsedTags,
    roomId,
    feedVisible: formData.get("feedVisible") !== "false",
  });
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const { title, category, context, content, tags, feedVisible } = parsed.data;
  await db.insert(ideas).values({
    title, category, context, content, tags, roomId, feedVisible,
    status: "published", totalLikes: 0, totalComments: 0, views: 0, userId: callerId,
  });

  revalidatePath(`/rooms/${roomId}`);
  redirect(`/rooms/${roomId}`);
}

// ─── UPDATE ─────────────────────────────────────────────────────────
export async function updateIdea(id: string, formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };
  try { await assertOwnership(id, callerId); } catch {
    return { success: false, errors: { form: ["Forbidden"] } };
  }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests"] } };

  const parsedTags = typeof formData.get("tags") === "string"
    ? (formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean).slice(0, 10)
    : [];

  const parsed = z.object({
    title:    z.string().min(1).max(120),
    context:  z.string().max(280).optional().default(""),
    content:  z.string().min(1).max(10000),
    tags:     z.array(z.string().max(30)).max(10).optional().default([]),
    category: z.string().max(50).optional(),
  }).safeParse({
    title: formData.get("title"),
    category: formData.get("category") || undefined,
    context: formData.get("context"),
    content: formData.get("content"),
    tags: parsedTags,
  });
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const { title, category, context, content, tags } = parsed.data;
  await db.update(ideas).set({
    title, category, context, content, tags, updatedAt: new Date(),
  }).where(eq(ideas.id, id));

  revalidatePath(`/idea/${id}`);
  return { success: true };
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deleteIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  let idea: Awaited<ReturnType<typeof assertOwnership>>;
  try { idea = await assertOwnership(id, callerId); } catch {
    return { success: false, error: "Forbidden" };
  }
  if (idea.title === "[deleted]") return { success: false, error: "Already deleted" };

  await db.update(ideas).set({
    status: "draft", title: "[deleted]", content: null, context: null, updatedAt: new Date(),
  }).where(eq(ideas.id, id));

  if (idea.roomId) revalidatePath(`/rooms/${idea.roomId}`);
  revalidatePath("/feed");
  return { success: true };
}

// ─── PUBLISH (simplified from launchIdea) ───────────────────────────
export async function publishIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  let idea: Awaited<ReturnType<typeof assertOwnership>>;
  try { idea = await assertOwnership(id, callerId); } catch {
    return { success: false, error: "Forbidden" };
  }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  await db.update(ideas).set({
    status: "published", updatedAt: new Date(),
  }).where(eq(ideas.id, id));

  if (idea.roomId) revalidatePath(`/rooms/${idea.roomId}`);
  revalidatePath("/feed");
  return { success: true };
}

// ─── SPARK (upvote) — atomic transaction ────────────────────────────
export async function sparkIdea(ideaId: string) {
  const viewerId = await getAuthenticatedUserId();
  if (!viewerId) return { success: false, error: "Not authenticated" };

  try {
    const { success } = await lightLimiter.limit(viewerId);
    if (!success) return { success: false, error: "Too many requests" };

    const [idea] = await db
      .select({ userId: ideas.userId, title: ideas.title })
      .from(ideas).where(eq(ideas.id, ideaId));
    if (!idea) return { success: false, error: "Idea not found" };
    if (idea.userId === viewerId) return { success: false, error: "Cannot spark your own idea" };

    const existing = await db
      .select({ id: ideaLikes.id }).from(ideaLikes)
      .where(and(eq(ideaLikes.userId, viewerId), eq(ideaLikes.ideaId, ideaId)));
    if (existing.length > 0) return { success: false, error: "Already sparked" };

    await db.transaction(async (tx) => {
      await tx.insert(ideaLikes).values({ userId: viewerId, ideaId });
      await tx.update(ideas).set({ totalLikes: sql`${ideas.totalLikes} + 1` }).where(eq(ideas.id, ideaId));
    });

    if (idea.userId) {
      await createNotification({
        userId: idea.userId, type: "spark",
        body: `Someone sparked your idea "${idea.title}"`,
        link: `/idea/${ideaId}`,
      });
    }

    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
  } catch (error) {
    console.error("sparkIdea failed:", error);
    return { success: false, error: "Server error" };
  }
}

// ─── RECORD VIEW ────────────────────────────────────────────────────
export async function recordView(ideaId: string): Promise<boolean> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;
  const { success } = await lightLimiter.limit(`view:${userId}`);
  if (!success) return false;
  await db.update(ideas).set({ views: sql`${ideas.views} + 1` }).where(eq(ideas.id, ideaId));
  return true;
}
