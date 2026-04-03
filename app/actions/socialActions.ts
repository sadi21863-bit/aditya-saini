// app/actions/socialActions.ts
"use server";

import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { lightLimiter } from "@/lib/ratelimit";

// FIX #1: Remove client-supplied followerId — derive it server-side from Clerk auth()
export async function followUser(targetId: string) {
    const { userId: followerId } = await auth();
    if (!followerId) return { success: false, error: "Unauthenticated" };

    try {
        if (followerId === targetId) {
            return { success: false, error: "Cannot follow yourself" };
        }

        const { success } = await lightLimiter.limit(followerId);
        if (!success) return { success: false, error: "Too many requests. Please slow down." };

        const existing = await db
            .select()
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, followerId),
                    eq(follows.followingId, targetId)
                )
            );

        if (existing.length > 0) {
            return { success: false, error: "Already following" };
        }

        await db.insert(follows).values({ followerId, followingId: targetId });

        revalidatePath(`/profile/${targetId}`);
        return { success: true };
    } catch (error) {
        console.error("Follow error:", error);
        return { success: false, error: "Failed to follow user" };
    }
}

// FIX #1: Same pattern for unfollowUser — no client-supplied followerId
export async function unfollowUser(targetId: string) {
    const { userId: followerId } = await auth();
    if (!followerId) return { success: false, error: "Unauthenticated" };

    try {
        const { success } = await lightLimiter.limit(followerId);
        if (!success) return { success: false, error: "Too many requests. Please slow down." };

        await db
            .delete(follows)
            .where(
                and(
                    eq(follows.followerId, followerId),
                    eq(follows.followingId, targetId)
                )
            );

        revalidatePath(`/profile/${targetId}`);
        return { success: true };
    } catch (error) {
        console.error("Unfollow error:", error);
        return { success: false, error: "Failed to unfollow user" };
    }
}

export async function getFollowers(userId: string) {
    try {
        const followers = await db
            .select({
                id: users.id,
                name: users.name,
                handle: users.handle,
                image: users.image,
                createdAt: follows.createdAt,
            })
            .from(follows)
            .leftJoin(users, eq(follows.followerId, users.id))
            .where(eq(follows.followingId, userId));

        return { success: true, followers };
    } catch (error) {
        console.error("Get followers error:", error);
        return { success: false, followers: [], error: "Failed to fetch followers" };
    }
}

export async function getFollowing(userId: string) {
    try {
        const following = await db
            .select({
                id: users.id,
                name: users.name,
                handle: users.handle,
                image: users.image,
                createdAt: follows.createdAt,
            })
            .from(follows)
            .leftJoin(users, eq(follows.followingId, users.id))
            .where(eq(follows.followerId, userId));

        return { success: true, following };
    } catch (error) {
        console.error("Get following error:", error);
        return { success: false, following: [], error: "Failed to fetch following" };
    }
}

export async function isFollowing(followerId: string, targetId: string) {
    try {
        const result = await db
            .select()
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, followerId),
                    eq(follows.followingId, targetId)
                )
            );

        return { success: true, isFollowing: result.length > 0 };
    } catch (error) {
        console.error("Check following error:", error);
        return { success: false, isFollowing: false };
    }
}

export async function getFollowStats(userId: string) {
    try {
        const [followersCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(follows)
            .where(eq(follows.followingId, userId));

        const [followingCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(follows)
            .where(eq(follows.followerId, userId));

        return {
            success: true,
            followers: Number(followersCount?.count || 0),
            following: Number(followingCount?.count || 0),
        };
    } catch (error) {
        console.error("Get stats error:", error);
        return { success: false, followers: 0, following: 0 };
    }
}
