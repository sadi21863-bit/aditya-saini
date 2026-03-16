"use server";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function toggleBookmark(ideaId: string) {
    let userId: string;
    try {
        userId = await requireAuth();
    } catch {
        return { success: false, error: "unauthenticated" };
    }

    const existing = await db.query.bookmarks.findFirst({
        where: and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.ideaId, ideaId)
        ),
    });

    if (existing) {
        await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
        return { success: true, bookmarked: false };
    }

    await db.insert(bookmarks).values({ userId, ideaId });
    return { success: true, bookmarked: true };
}

export async function getUserBookmarks(userId: string) {
    return db.query.bookmarks.findMany({
        where: eq(bookmarks.userId, userId),
        orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
}

export async function isBookmarked(userId: string, ideaId: string) {
    const result = await db.query.bookmarks.findFirst({
        where: and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.ideaId, ideaId)
        ),
    });
    return !!result;
}
