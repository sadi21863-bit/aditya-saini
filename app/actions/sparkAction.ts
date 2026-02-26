'use server'

import { db } from "@/db";
import { ideas, likes } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function sparkVision(ideaId: string, viewerId: string) {
    try {
        // 1. Check for duplicate like (also enforced by DB unique index)
        const existing = await db.select().from(likes)
            .where(and(eq(likes.userId, viewerId), eq(likes.ideaId, ideaId)));

        if (existing.length > 0) {
            return { success: false, error: "Already liked" };
        }

        // 2. Record the like
        await db.insert(likes).values({ userId: viewerId, ideaId });

        // 3. Increment totalLikes on the idea
        await db.update(ideas)
            .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
            .where(eq(ideas.id, ideaId));

        revalidatePath("/aether");
        return { success: true };
    } catch (error) {
        console.error("Like failed:", error);
        return { success: false };
    }
}
