"use server";
import { db } from "@/db";
import { ideas, likes } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Unified engagement handler: records a like and increments counter
export async function processSpark(ideaId: string, userId: string) {
    try {
        // 1. Prevent duplicate likes
        const existing = await db.select().from(likes)
            .where(and(eq(likes.userId, userId), eq(likes.ideaId, ideaId)));

        if (existing.length > 0) {
            return { success: false, error: "Already liked" };
        }

        // 2. Record the like
        await db.insert(likes).values({ userId, ideaId });

        // 3. Increment totalLikes on the idea
        await db.update(ideas)
            .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
            .where(eq(ideas.id, ideaId));

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Engagement Error:", error);
        return { success: false };
    }
}
