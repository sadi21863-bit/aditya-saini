"use server";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { lightLimiter } from "@/lib/ratelimit";

export async function toggleBookmark(
  targetId: string,
  targetType: "idea" | "room" = "idea"
): Promise<{ success: boolean; bookmarked?: boolean; error?: string }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: "Not authenticated" };

  const { success } = await lightLimiter.limit(userId);
  if (!success) return { success: false, error: "Too many requests" };

  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.targetType, targetType),
        eq(bookmarks.targetId, targetId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
    return { success: true, bookmarked: false };
  }

  await db.insert(bookmarks).values({ userId, targetType, targetId });
  return { success: true, bookmarked: true };
}

export async function isBookmarked(
  userId: string,
  targetId: string,
  targetType: "idea" | "room" = "idea"
): Promise<boolean> {
  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.targetType, targetType),
        eq(bookmarks.targetId, targetId)
      )
    )
    .limit(1);

  return existing.length > 0;
}

export async function getBookmarks(targetType?: "idea" | "room") {
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const conditions = [eq(bookmarks.userId, userId)];
  if (targetType) conditions.push(eq(bookmarks.targetType, targetType));

  return db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(bookmarks.createdAt);
}
