// lib/hangar-queries.ts — v12
import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Returns all draft ideas for a given user.
 * v12: status values are "draft" | "published" (not "public").
 */
export async function getHangarIdeas(userId: string) {
  return db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), eq(ideas.status, "draft")));
}
