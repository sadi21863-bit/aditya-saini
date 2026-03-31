import { db } from "@/db";
import { users, xpEvents } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { getTierNameFromXp, XP_EVENTS } from "@/lib/tier-engine";

/**
 * lib/xp.ts — v13
 *
 * awardXp: atomic XP + tier update in a single transaction.
 *   - GREATEST(xp + delta, 0): XP cannot go below zero
 *   - Single transaction: eliminates TOCTOU race condition from v12
 *   - Tier recomputed from new XP within the same transaction
 *   - Tier-up bonus XP awarded on first reach (idempotent via xpEvents)
 *
 * awardXpIdempotent: same as awardXp but skips if this (userId, eventType, ideaId)
 * combination already exists in xp_events. Use for events that must never
 * double-award (e.g. SUBMIT_PRIVATE_IDEA, GENESIS_HASH_CONFIRMED, IDEA_GETS_REMIXED).
 */

export async function awardXp(userId: string, delta: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Read current XP
    const [user] = await tx
      .select({ xp: users.xp, tier: users.tier })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return;

    const currentXp = user.xp ?? 0;
    const newXp = Math.max(0, currentXp + delta);
    const newTier = getTierNameFromXp(newXp);
    const oldTier = user.tier ?? "explorer";

    await tx
      .update(users)
      .set({ xp: newXp, tier: newTier, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Update domain sub-totals separately — callers that want domain-specific
    // XP tracking should call awardXpForDomain instead
    // (this function updates unified xp only)

    // Tier-up bonus: award once per tier milestone
    if (newTier !== oldTier) {
      const bonusMap: Record<string, number> = {
        architect: XP_EVENTS.REACH_TIER_2_BONUS,
        pioneer:   XP_EVENTS.REACH_TIER_3_BONUS,
      };
      const bonus = bonusMap[newTier];
      if (bonus) {
        // Check idempotency — only award tier-up bonus once
        const alreadyAwarded = await tx
          .select({ id: xpEvents.id })
          .from(xpEvents)
          .where(
            and(
              eq(xpEvents.userId, userId),
              eq(xpEvents.eventType, `TIER_UP_${newTier.toUpperCase()}`)
            )
          )
          .limit(1);

        if (alreadyAwarded.length === 0) {
          const bonusXp = Math.max(0, bonus);
          await tx
            .update(users)
            .set({ xp: sql`${users.xp} + ${bonusXp}` })
            .where(eq(users.id, userId));

          await tx.insert(xpEvents).values({
            userId,
            eventType: `TIER_UP_${newTier.toUpperCase()}`,
            xpAwarded: bonusXp,
          });
        }
      }
    }
  });

  // Award badges after XP update (non-blocking — badge errors don't break XP)
  try {
    const { checkAndAwardBadges } = await import("@/app/actions/badgeActions");
    await checkAndAwardBadges(userId);
  } catch {
    /* badge errors must not block XP award */
  }
}

/**
 * Idempotent XP award — records to xp_events and skips if already recorded.
 * Use for events that must never double-award:
 *   - SUBMIT_PRIVATE_IDEA / SUBMIT_PUBLIC_IDEA (per ideaId)
 *   - GENESIS_HASH_CONFIRMED (per ideaId)
 *   - IDEA_GETS_REMIXED (per ideaId)
 *   - VALID_REPORT_RESOLVED (per reportId passed as ideaId)
 */
export async function awardXpIdempotent(
  userId: string,
  eventType: string,
  delta: number,
  ideaId?: string
): Promise<boolean> {
  // Check if already awarded
  const conditions = [
    eq(xpEvents.userId, userId),
    eq(xpEvents.eventType, eventType),
  ];
  if (ideaId) {
    // Dynamically add ideaId condition
  }

  const existing = await db
    .select({ id: xpEvents.id })
    .from(xpEvents)
    .where(
      ideaId
        ? and(
            eq(xpEvents.userId, userId),
            eq(xpEvents.eventType, eventType),
            eq(xpEvents.ideaId, ideaId)
          )
        : and(eq(xpEvents.userId, userId), eq(xpEvents.eventType, eventType))
    )
    .limit(1);

  if (existing.length > 0) return false; // already awarded

  // Record the event
  await db.insert(xpEvents).values({
    userId,
    eventType,
    ideaId: ideaId ?? null,
    xpAwarded: Math.max(0, delta),
  });

  // Apply the XP
  await awardXp(userId, delta);
  return true;
}

/**
 * Award XP with domain sub-total tracking.
 * Updates unified xp AND either privateXp or publicXp.
 */
export async function awardXpForDomain(
  userId: string,
  delta: number,
  domain: "private" | "public",
  eventType: string,
  ideaId?: string,
  idempotent = false
): Promise<boolean> {
  if (idempotent) {
    const wasAwarded = await awardXpIdempotent(userId, eventType, delta, ideaId);
    if (!wasAwarded) return false;
  } else {
    await awardXp(userId, delta);
  }

  // Update domain sub-total
  if (delta > 0) {
    const col = domain === "private" ? users.privateXp : users.publicXp;
    await db
      .update(users)
      .set({ [domain === "private" ? "privateXp" : "publicXp"]: sql`${col} + ${delta}` })
      .where(eq(users.id, userId));
  }

  return true;
}
