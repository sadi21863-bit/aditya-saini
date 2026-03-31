"use server";

import { db } from "@/db";
import { reviews, ideas, users } from "@/db/schema";
import { eq, and, avg, count, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth";
import { writeLimiter } from "@/lib/ratelimit";
import { awardXp, awardXpForDomain } from "@/lib/xp";
import { XP_EVENTS } from "@/lib/tier-engine";
import { canWriteReview } from "@/lib/tier-engine";
import { createNotification } from "@/app/actions/notificationActions";
import { z } from "zod";

const REVIEW_WINDOW_HOURS = 24;

const VALID_VERDICTS = ["valid", "needs_work", "invalid"] as const;
const VALID_TAGS = ["well_researched", "vague", "duplicate", "innovative"] as const;

const ReviewSchema = z.object({
  ideaId: z.string().uuid(),
  verdict: z.enum(VALID_VERDICTS),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(VALID_TAGS)).max(4).default([]),
  commentId: z.string().uuid().optional(),
});

// ─── SUBMIT REVIEW ────────────────────────────────────────────────────────────
export async function submitReview(data: unknown) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success: rateOk } = await writeLimiter.limit(callerId);
  if (!rateOk) return { success: false, error: "Too many requests. Please slow down." };

  const parsed = ReviewSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { ideaId, verdict, rating, tags, commentId } = parsed.data;

  // Tier gate: Tier 1+ required
  const [user] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, callerId));
  if (!canWriteReview(user?.tier ?? "explorer")) {
    return { success: false, error: "Builder tier (100 XP) required to write reviews" };
  }

  // Fetch the idea
  const [idea] = await db
    .select({ id: ideas.id, userId: ideas.userId, title: ideas.title, status: ideas.status, domain: ideas.domain })
    .from(ideas)
    .where(eq(ideas.id, ideaId));

  if (!idea) return { success: false, error: "Idea not found" };
  if (idea.status !== "published") return { success: false, error: "Idea is not published" };
  if (idea.userId === callerId) return { success: false, error: "Cannot review your own idea" };

  // Check UNIQUE constraint (one review per user per idea)
  const existing = await db
    .select({ id: reviews.id, createdAt: reviews.createdAt })
    .from(reviews)
    .where(and(eq(reviews.ideaId, ideaId), eq(reviews.userId, callerId)))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "You have already reviewed this idea" };
  }

  await db.insert(reviews).values({
    ideaId,
    userId: callerId,
    commentId: commentId ?? null,
    verdict,
    rating,
    tags,
  });

  // Award XP to reviewer (idempotent per idea+user)
  await awardXp(callerId, XP_EVENTS.SUBMIT_PEER_REVIEW);

  // Notify idea owner
  if (idea.userId) {
    await createNotification({
      userId: idea.userId,
      type: "review",
      body: `Your idea "${idea.title}" received a peer review (${verdict})`,
      link: `/idea/${ideaId}`,
    });
  }

  // Check if idea now has 5+ reviews — award bonus XP to owner once
  if (idea.userId) {
    const [reviewCount] = await db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.ideaId, ideaId));

    if ((reviewCount?.count ?? 0) >= 5) {
      const domain = (idea.domain ?? "private") as "private" | "public";
      await awardXpForDomain(
        idea.userId,
        XP_EVENTS.IDEA_GETS_5_REVIEWS,
        domain,
        "IDEA_GETS_5_REVIEWS",
        ideaId,
        true // idempotent — only award once
      );
    }
  }

  revalidatePath(`/idea/${ideaId}`);
  return { success: true };
}

// ─── GET REVIEWS ──────────────────────────────────────────────────────────────
export async function getReviews(ideaId: string) {
  const rows = await db
    .select({
      id: reviews.id,
      verdict: reviews.verdict,
      rating: reviews.rating,
      tags: reviews.tags,
      createdAt: reviews.createdAt,
      commentId: reviews.commentId,
      userId: reviews.userId,
      userName: users.name,
      userHandle: users.handle,
      userTier: users.tier,
      userXp: users.xp,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.ideaId, ideaId))
    .orderBy(desc(reviews.createdAt));

  return rows.map((r) => ({
    id: r.id,
    verdict: r.verdict,
    rating: r.rating,
    tags: r.tags,
    createdAt: r.createdAt,
    commentId: r.commentId,
    isEditable: isReviewEditable(r.createdAt),
    user: {
      id: r.userId,
      name: r.userName,
      handle: r.userHandle,
      tier: r.userTier,
      xp: r.userXp ?? 0,
    },
  }));
}

// ─── GET REVIEW SUMMARY ───────────────────────────────────────────────────────
export async function getReviewSummary(ideaId: string) {
  const [summary] = await db
    .select({
      totalReviews: count(),
      avgRating: avg(reviews.rating),
    })
    .from(reviews)
    .where(eq(reviews.ideaId, ideaId));

  const verdictCounts = await db
    .select({
      verdict: reviews.verdict,
      count: count(),
    })
    .from(reviews)
    .where(eq(reviews.ideaId, ideaId))
    .groupBy(reviews.verdict);

  const distribution: Record<string, number> = {};
  for (const row of verdictCounts) {
    distribution[row.verdict] = row.count;
  }

  return {
    totalReviews: summary?.totalReviews ?? 0,
    avgRating: summary?.avgRating ? Number(Number(summary.avgRating).toFixed(1)) : null,
    distribution: {
      valid: distribution["valid"] ?? 0,
      needs_work: distribution["needs_work"] ?? 0,
      invalid: distribution["invalid"] ?? 0,
    },
  };
}

// ─── CHECK IF REVIEWER HAS REVIEWED ──────────────────────────────────────────
export async function hasUserReviewed(ideaId: string, userId: string): Promise<boolean> {
  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.ideaId, ideaId), eq(reviews.userId, userId)))
    .limit(1);
  return existing.length > 0;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function isReviewEditable(createdAt: Date | null): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs < REVIEW_WINDOW_HOURS * 60 * 60 * 1000;
}
