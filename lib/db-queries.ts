// lib/db-queries.ts
import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * lib/db-queries.ts  — v11-justice
 * Shared read-only query helpers.
 * Fixed: removed stale contributorIds + blurLevel refs (schema v10+)
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
        protectionLevel: ideas.protectionLevel,
        genesisHash: ideas.genesisHash,
        flair: ideas.flair,
        editorsPick: ideas.editorsPick,
        viewerIds: ideas.viewerIds,
        createdAt: ideas.createdAt,
        user: {
          id: users.id,
          name: users.name,
          tier: users.tier,
          xp: users.xp,
        },
      })
      .from(ideas)
      .leftJoin(users, eq(ideas.userId, users.id))
      .where(eq(ideas.status, "public"))
      .orderBy(desc(ideas.createdAt));
  } catch (error) {
    console.error("DB Fetch Error:", error);
    return [];
  }
}

/** @deprecated use getFeedData() */
export const getAetherFeedData = getFeedData;
