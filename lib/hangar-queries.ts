import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * lib/hangar-queries.ts
 *
 * Returns all draft ideas for a given user.
 * "archived" was a legacy status that never existed in the DB —
 * the schema only has "draft" and "public".
 */
export async function getHangarIdeas(userId: string) {
  return db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), eq(ideas.status, "draft")));
}
