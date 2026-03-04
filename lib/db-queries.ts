import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * lib/db-queries.ts
 *
 * Shared read-only query helpers.
 * Column names reflect the Phase 2 schema:
 *   genesisHash (was genesisCode), blurLevel, views, contributorIds
 */
export async function getFeedData() {
  try {
    return await db
      .select({
        id:           ideas.id,
        title:        ideas.title,
        hook:         ideas.hook,
        content:      ideas.content,
        category:     ideas.category,
        status:       ideas.status,
        totalLikes:   ideas.totalLikes,
        views:        ideas.views,
        blurLevel:    ideas.blurLevel,
        genesisHash:  ideas.genesisHash,
        contributorIds: ideas.contributorIds,
        createdAt:    ideas.createdAt,
        user: {
          id:   users.id,
          name: users.name,
          tier: users.tier,
          xp:   users.xp,
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
