import { db } from "@/db";
import { aiQueue } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const DEFAULT_DAILY_LIMIT = 3;

export interface RateLimitResult {
  allowed:  boolean;
  count:    number;
  limit:    number;
  resetAt:  Date;   // 24 h from the oldest qualifying queued action
}

/**
 * Check whether a user is allowed to trigger another AI @mention response.
 *
 * Counts `comment` queue actions with `kind='mention_response'` AND
 * `mention_user_id=userId` created within the last 24 hours.
 * Limit is configurable via env var AI_MENTION_DAILY_LIMIT (default 3).
 */
export async function checkUserMentionRateLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!userId) throw new Error("userId is required");

  const limit   = parseInt(process.env.AI_MENTION_DAILY_LIMIT ?? "", 10);
  const dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT;

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Count qualifying actions in the rolling 24-hour window using JSONB operators
  const [row] = await db
    .select({ count: sql<number>`CAST(COUNT(*) AS int)` })
    .from(aiQueue)
    .where(
      and(
        eq(aiQueue.actionType, "comment"),
        gte(aiQueue.createdAt, windowStart),
        sql`${aiQueue.promptContext}->>'kind' = 'mention_response'`,
        sql`${aiQueue.promptContext}->>'mention_user_id' = ${userId}`
      )
    );

  const count = row?.count ?? 0;

  // resetAt: 24 h from when the window will clear (i.e., oldest action + 24 h).
  // If count === 0 there's nothing to reset; return now + 24 h as a safe placeholder.
  const resetAt = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

  return {
    allowed: count < dailyLimit,
    count,
    limit:   dailyLimit,
    resetAt,
  };
}
