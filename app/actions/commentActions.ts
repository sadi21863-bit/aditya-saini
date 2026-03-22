"use server";

import { db } from "@/db";
import { peerReviews, comments, users } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getTierFromXp, XP_EVENTS } from "@/lib/tier-engine";
import { z } from "zod";
import { createNotification } from "./notificationActions";
import { ideas } from "@/db/schema";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";
import { awardXp } from "@/app/actions/ideaActions";

// Canonical TIER_WEIGHTS — exported so PeerReviewBox.tsx can import from here
export const TIER_WEIGHTS: Record<string, number> = {
    dreamer: 1,
    visionary: 1.5,
    architect: 2,
    oracle: 5,
};

function getTierWeight(xp: number): number {
    const tier = getTierFromXp(xp);
    return TIER_WEIGHTS[tier.name] ?? 1;
}

const PeerReviewSchema = z.object({
    ideaId: z.string().uuid(),
    feasibility: z.number().min(1).max(5),
    originality: z.number().min(1).max(5),
    impact: z.number().min(1).max(5),
    comment: z.string().max(1000).optional(),
});

export async function submitPeerReview(
    ideaId: string,
    ratings: { feasibility: number; originality: number; impact: number },
    comment?: string
) {
    const callerId = await getAuthenticatedUserId();
    if (!callerId) return { success: false, error: "Not authenticated" };

    const { success } = await writeLimiter.limit(callerId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const parsed = PeerReviewSchema.safeParse({ ideaId, ...ratings, comment });
    if (!parsed.success)
        return { success: false, error: parsed.error.flatten().fieldErrors };

    const [idea] = await db
        .select({ userId: ideas.userId, title: ideas.title })
        .from(ideas)
        .where(eq(ideas.id, ideaId));
    if (!idea) return { success: false, error: "Idea not found" };
    if (idea.userId === callerId)
        return { success: false, error: "Cannot review your own idea" };

    const existing = await db
        .select({ id: peerReviews.id })
        .from(peerReviews)
        .where(and(eq(peerReviews.ideaId, ideaId), eq(peerReviews.reviewerId, callerId)));
    if (existing.length > 0)
        return { success: false, error: "You have already reviewed this idea" };

    const [reviewer] = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, callerId));
    const tierWeight = getTierWeight(reviewer?.xp ?? 0);

    const rawAvg = (ratings.feasibility + ratings.originality + ratings.impact) / 3;
    const avgScore = parseFloat((rawAvg * tierWeight).toFixed(2));

    await db.insert(peerReviews).values({
        ideaId,
        reviewerId: callerId,
        ratings,
        comment: comment?.trim() || null,
        tierWeight,
        avgScore,
    });

    // Fix #28: Award XP to reviewer for submitting a peer review
    await awardXp(callerId, XP_EVENTS.PEER_REVIEW_GIVEN);

    if (idea.userId) {
        await createNotification({
            userId: idea.userId,
            type: "comment",
            body: `Your idea "${idea.title}" received a peer review (Score: ${avgScore.toFixed(1)})`,
            link: `/idea/${ideaId}`,
        });
    }

    revalidatePath(`/idea/${ideaId}`);
    return { success: true, avgScore };
}

export async function getPeerReviews(ideaId: string) {
    const rows = await db
        .select({
            id: peerReviews.id,
            ratings: peerReviews.ratings,
            comment: peerReviews.comment,
            tierWeight: peerReviews.tierWeight,
            avgScore: peerReviews.avgScore,
            createdAt: peerReviews.createdAt,
            reviewerId: peerReviews.reviewerId,
            reviewerName: users.name,
            reviewerHandle: users.handle,
            reviewerImage: users.image,
            reviewerXp: users.xp,
        })
        .from(peerReviews)
        .leftJoin(users, eq(peerReviews.reviewerId, users.id))
        .where(eq(peerReviews.ideaId, ideaId))
        .orderBy(desc(peerReviews.avgScore));

    return rows.map((r) => ({
        id: r.id,
        ratings: r.ratings as { feasibility: number; originality: number; impact: number },
        comment: r.comment,
        tierWeight: r.tierWeight,
        avgScore: r.avgScore,
        createdAt: r.createdAt,
        reviewer: {
            id: r.reviewerId,
            name: r.reviewerName,
            handle: r.reviewerHandle,
            image: r.reviewerImage,
            tier: getTierFromXp(r.reviewerXp ?? 0).name,
            xp: r.reviewerXp ?? 0,
        },
    }));
}

export async function deletePeerReview(reviewId: string, ideaId: string) {
    const callerId = await getAuthenticatedUserId();
    if (!callerId) return { success: false, error: "Not authenticated" };

    const { success } = await lightLimiter.limit(callerId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const [review] = await db
        .select({ reviewerId: peerReviews.reviewerId })
        .from(peerReviews)
        .where(eq(peerReviews.id, reviewId));

    if (!review) return { success: false, error: "Review not found" };
    if (review.reviewerId !== callerId) return { success: false, error: "Forbidden" };

    await db.delete(peerReviews).where(eq(peerReviews.id, reviewId));
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
}

export async function addComment(ideaId: string, content: string) {
    const callerId = await getAuthenticatedUserId();
    if (!callerId) return { success: false, error: "Not authenticated" };

    const { success } = await writeLimiter.limit(callerId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const trimmed = content?.trim();
    if (!trimmed) return { success: false, error: "Comment cannot be empty" };
    if (trimmed.length > 1000) return { success: false, error: "Too long" };

    await db.insert(comments).values({ ideaId, userId: callerId, content: trimmed });
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
}

export async function deleteComment(commentId: string, ideaId: string) {
    const callerId = await getAuthenticatedUserId();
    if (!callerId) return { success: false, error: "Not authenticated" };

    const { success } = await lightLimiter.limit(callerId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const [comment] = await db
        .select({ userId: comments.userId })
        .from(comments)
        .where(eq(comments.id, commentId));
    if (!comment) return { success: false, error: "Not found" };
    if (comment.userId !== callerId) return { success: false, error: "Forbidden" };

    await db.delete(comments).where(eq(comments.id, commentId));
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
}

export async function getComments(ideaId: string) {
    const rows = await db
        .select({
            id: comments.id, content: comments.content, createdAt: comments.createdAt,
            userId: comments.userId, userName: users.name, userHandle: users.handle,
            userImage: users.image, userTier: users.tier, userXp: users.xp,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.ideaId, ideaId))
        .orderBy(desc(comments.createdAt));

    return rows.map((r) => ({
        id: r.id, content: r.content, createdAt: r.createdAt,
        user: {
            id: r.userId, name: r.userName, handle: r.userHandle,
            image: r.userImage, tier: r.userTier, xp: r.userXp ?? 0,
        },
    }));
}
