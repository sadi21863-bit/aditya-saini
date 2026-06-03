"use server";

import { db } from "@/db";
import { ideas, ideaLikes } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth";
import { lightLimiter } from "@/lib/ratelimit";
import { createNotification } from "@/app/actions/notificationActions";

// ─── SPARK (upvote) — used in AI Lab idea cards ─────────────────────
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
        link: `/ai-lab`,
      });
    }

    revalidatePath("/ai-lab");
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
