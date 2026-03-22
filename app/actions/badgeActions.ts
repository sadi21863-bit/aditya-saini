"use server";

import { db } from "@/db";
import { users, peerReviews, ideas, follows, comments } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { computeNewBadges, getBadge, BADGE_REGISTRY, type UserStats } from "@/lib/badge-engine";
import { createNotification } from "./notificationActions";

async function buildUserStats(userId: string): Promise<UserStats> {
    const [user] = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, userId));

    const [ideasRow] = await db
        .select({ count: count() })
        .from(ideas)
        .where(sql`${ideas.userId} = ${userId} AND ${ideas.status} = 'public'`);

    const [likesRow] = await db
        .select({ total: sql<number>`COALESCE(SUM(${ideas.totalLikes}), 0)` })
        .from(ideas)
        .where(sql`${ideas.userId} = ${userId}`);

    const [followersRow] = await db
        .select({ count: count() })
        .from(follows)
        .where(eq(follows.followingId, userId));

    const [reviewsRow] = await db
        .select({ count: count() })
        .from(peerReviews)
        .where(eq(peerReviews.reviewerId, userId));

    const [commentsRow] = await db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.userId, userId));

    return {
        xp: user?.xp ?? 0,
        ideasLaunched: ideasRow?.count ?? 0,
        totalLikes: Number(likesRow?.total ?? 0),
        followers: followersRow?.count ?? 0,
        peerReviews: reviewsRow?.count ?? 0,
        commentsGiven: commentsRow?.count ?? 0,
    };
}

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
    const [user] = await db
        .select({ badges: users.badges })
        .from(users)
        .where(eq(users.id, userId));

    if (!user) return [];

    const stats = await buildUserStats(userId);
    const newSlugs = computeNewBadges(stats, user.badges ?? []);

    if (newSlugs.length === 0) return [];

    // Fix #43: Use safe parameterised array_cat instead of sql.raw string interpolation
    // which is a SQL injection risk pattern.
    await db
      .update(users)
      .set({
        badges: sql`array_cat(${users.badges}, ${newSlugs}::text[])`,
      })
      .where(eq(users.id, userId));

    for (const slug of newSlugs) {
        const badge = getBadge(slug);
        if (badge) {
            await createNotification({
                userId,
                type: "milestone",
                body: `🏅 You earned the "${badge.emoji} ${badge.name}" badge! ${badge.description}`,
                link: `/profile`,
            });
        }
    }

    return newSlugs;
}

export async function getUserBadges(userId: string) {
    const [user] = await db
        .select({ badges: users.badges })
        .from(users)
        .where(eq(users.id, userId));

    if (!user?.badges?.length) return [];

    return user.badges
        .map((slug) => BADGE_REGISTRY.find((b) => b.slug === slug))
        .filter(Boolean);
}
    