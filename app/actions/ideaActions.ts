"use server";

import { db } from "@/db";
import { ideas, ideaLikes, users, notifications } from "@/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { XP_EVENTS } from "@/lib/tier-engine";
import { generateGenesisHash } from "@/lib/hash";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";
import { awardXp } from "@/lib/xp";
import { createNotification } from "@/app/actions/notificationActions";

// v12: categories remain the same
const VALID_CATEGORIES = [
  "Tech",
  "Design",
  "Social",
  "Finance",
  "Creative",
  "General",
] as const;

const IdeaWriteSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title too long"),
  category: z.enum(VALID_CATEGORIES),
  context: z.string().max(280).optional().default(""),
  content: z.string().min(1, "Content is required").max(10000),
  // v12: ipProtected is a boolean (not a string protectionLevel enum)
  ipProtected: z.boolean().optional().default(false),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

async function assertOwnership(ideaId: string, callerId: string) {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) throw new Error("Idea not found");
  if (idea.userId !== callerId) throw new Error("Forbidden: you do not own this idea");
  return idea;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
export async function addIdea(formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests. Please slow down."] } };

  // Parse tags from comma-separated string or JSON array field
  let parsedTags: string[] = [];
  const tagsRaw = formData.get("tags");
  if (tagsRaw && typeof tagsRaw === "string") {
    parsedTags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  const ipProtectedRaw = formData.get("ipProtected");
  const ipProtected =
    ipProtectedRaw === "true" || ipProtectedRaw === "1" || ipProtectedRaw === "on";

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    context: formData.get("context"),
    content: formData.get("content"),
    ipProtected,
    tags: parsedTags,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { title, category, context, content, ipProtected: ip, tags } = parsed.data;

  await db.insert(ideas).values({
    title,
    category,
    context,
    content,
    ipProtected: ip,
    tags,
    status: "draft",
    domain: "vault",
    totalLikes: 0,
    totalComments: 0,
    views: 0,
    userId: callerId,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=drafts");
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateIdea(id: string, formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };

  try {
    await assertOwnership(id, callerId);
  } catch {
    return { success: false, errors: { form: ["Forbidden"] } };
  }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests. Please slow down."] } };

  let parsedTags: string[] = [];
  const tagsRaw = formData.get("tags");
  if (tagsRaw && typeof tagsRaw === "string") {
    parsedTags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  const ipProtectedRaw = formData.get("ipProtected");
  const ipProtected =
    ipProtectedRaw === "true" || ipProtectedRaw === "1" || ipProtectedRaw === "on";

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    context: formData.get("context"),
    content: formData.get("content"),
    ipProtected,
    tags: parsedTags,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { title, category, context, content, ipProtected: ip, tags } = parsed.data;

  await db
    .update(ideas)
    .set({
      title,
      category,
      context,
      content,
      ipProtected: ip,
      tags,
      updatedAt: new Date(),
    })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath(`/idea/${id}`);
  redirect("/dashboard");
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function deleteIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  try {
    await assertOwnership(id, callerId);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  // Soft-delete: blank the content, mark status=draft so it falls off feed
  await db
    .update(ideas)
    .set({
      status: "draft",
      title: "[deleted]",
      content: null,
      context: null,
      updatedAt: new Date(),
    })
    .where(eq(ideas.id, id));

  await awardXp(callerId, XP_EVENTS.DELETE_IDEA);

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── LAUNCH (publish to feed) ─────────────────────────────────────────────────
export async function launchIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  let idea: Awaited<ReturnType<typeof assertOwnership>>;
  try {
    idea = await assertOwnership(id, callerId);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const launchedAt = new Date();

  // Genesis hash: generate once, never overwrite
  const genesisHash = idea.genesisHash
    ? idea.genesisHash
    : await generateGenesisHash(idea.title, idea.content ?? "", callerId, launchedAt);

  await db
    .update(ideas)
    .set({
      status: "published",
      genesisHash,
      updatedAt: launchedAt,
    })
    .where(eq(ideas.id, id));

  // Award XP only on first launch (when genesisHash was just created)
  if (!idea.genesisHash) {
    await awardXp(callerId, XP_EVENTS.LAUNCH_IDEA);
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── RECALL (un-publish back to draft) ───────────────────────────────────────
export async function recallIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  try {
    await assertOwnership(id, callerId);
  } catch {
    return { success: false, error: "Forbidden" };
  }

  await db
    .update(ideas)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── SPARK (like a vault idea) ────────────────────────────────────────────────
export async function sparkIdea(ideaId: string, viewerId: string) {
  try {
    const { success } = await lightLimiter.limit(viewerId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const [idea] = await db
      .select({ userId: ideas.userId, totalLikes: ideas.totalLikes, title: ideas.title })
      .from(ideas)
      .where(eq(ideas.id, ideaId));

    if (!idea) return { success: false, error: "Idea not found" };

    if (idea.userId === viewerId) {
      return { success: false, error: "Cannot spark your own idea" };
    }

    // v12: use ideaLikes table (not the old likes table)
    const existing = await db
      .select({ id: ideaLikes.id })
      .from(ideaLikes)
      .where(and(eq(ideaLikes.userId, viewerId), eq(ideaLikes.ideaId, ideaId)));

    if (existing.length > 0) {
      return { success: false, error: "Already liked" };
    }

    await db.insert(ideaLikes).values({ userId: viewerId, ideaId });

    await db
      .update(ideas)
      .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
      .where(eq(ideas.id, ideaId));

    if (idea.userId) {
      await awardXp(idea.userId, XP_EVENTS.RECEIVE_LIKE);

      await createNotification({
        userId: idea.userId,
        type: "spark",
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

// ─── RECORD VIEW ──────────────────────────────────────────────────────────────
export async function recordView(ideaId: string): Promise<boolean> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;

  const { success } = await lightLimiter.limit(`view:${userId}`);
  if (!success) return false;

  await db
    .update(ideas)
    .set({ views: sql`${ideas.views} + 1` })
    .where(eq(ideas.id, ideaId));

  return true;
}
// ─── REQUEST ACCESS ───────────────────────────────────────────
export async function requestAccess(ideaId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) return { success: false, error: "Idea not found" };
  if (idea.userId === callerId) return { success: false, error: "You are the Genesis Creator" };

  return { success: true, message: "✅ Access Granted!" };
}