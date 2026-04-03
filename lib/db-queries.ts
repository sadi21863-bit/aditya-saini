// lib/db-queries.ts — v12
import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Shared read-only query helpers.
 * v12: removed protectionLevel, flair, viewerIds (deleted columns).
 * status filter changed from "public" → "published".
 */
export async function getFeedData() {
  try {
    return await db
      .select({
        id: ideas.id,
        title: ideas.title,
        context: ideas.context,
        content: ideas.content,
        category: ideas.category,
        status: ideas.status,
        totalLikes: ideas.totalLikes,
        views: ideas.views,
        roomId: ideas.roomId,
        createdAt: ideas.createdAt,
        user: {
          id: users.id,
          name: users.name,
          handle: users.handle,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.userId, users.id))
      .where(eq(ideas.status, "published"))
      .orderBy(desc(ideas.createdAt));
  } catch (error) {
    console.error("DB Fetch Error:", error);
    return [];
  }
}

/** @deprecated use getFeedData() */
export const getAetherFeedData = getFeedData;
