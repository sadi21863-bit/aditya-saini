"use server";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { lightLimiter } from "@/lib/ratelimit";

export async function toggleBookmark(ideaId: string) {
    let userId: string;
    try {
        userId = await requireAuth();
    } catch {
        return { success: false, error: "unauthenticated" };
    }

    const { success } = await lightLimiter.limit(userId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

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

// FIX #38: getUserBookmarks was exported but never called anywhere.
// bookmarks/page.tsx queries inline. Removed to avoid dead API surface.

export async function isBookmarked(userId: string, ideaId: string) {
    const result = await db.query.bookmarks.findFirst({
        where: and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.ideaId, ideaId)
        ),
    });
    return !!result;
}
