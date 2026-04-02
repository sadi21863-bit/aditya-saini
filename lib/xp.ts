import { db } from "@/db";
import { users, xpEvents } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { getTierNameFromXp, XP_EVENTS } from "@/lib/tier-engine";

/** Award XP and recalculate tier. Wrapped in transaction. */
export async function awardXp(userId: string, delta: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ xp: users.xp, tier: users.tier })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return;

    const newXp  = Math.max(0, (user.xp ?? 0) + delta);
    const newTier = getTierNameFromXp(newXp);
    const oldTier = user.tier ?? "explorer";

    await tx
      .update(users)
      .set({ xp: newXp, tier: newTier, updatedAt: new Date() })
      .where(eq(users.id, userId));

    if (newTier !== oldTier) {
      const bonusMap: Record<string, number> = {
        architect: XP_EVENTS.REACH_TIER_2_BONUS,
        pioneer:   XP_EVENTS.REACH_TIER_3_BONUS,
      };
      const bonus = bonusMap[newTier];
      if (bonus) {
        const alreadyAwarded = await tx
          .select({ id: xpEvents.id })
          .from(xpEvents)
          .where(and(eq(xpEvents.userId, userId), eq(xpEvents.eventType, `TIER_UP_${newTier.toUpperCase()}`)))
          .limit(1);

        if (alreadyAwarded.length === 0) {
          const bonusXp = Math.max(0, bonus);
          await tx.update(users).set({ xp: sql`${users.xp} + ${bonusXp}` }).where(eq(users.id, userId));
          await tx.insert(xpEvents).values({ userId, eventType: `TIER_UP_${newTier.toUpperCase()}`, xpAwarded: bonusXp });
        }
      }
    }
  });

  try {
    const { checkAndAwardBadges } = await import("@/app/actions/badgeActions");
    await checkAndAwardBadges(userId);
  } catch { /* badge errors must not block XP */ }
}

/**
 * Idempotent XP award — skips if xp_events already has this eventType + ideaId combo.
 * P0.3 fix: removed dead `conditions` array. where() filtering is inline below.
 */
export async function awardXpIdempotent(
  userId: string, eventType: string, delta: number, ideaId?: string
): Promise<boolean> {
  const existing = await db
    .select({ id: xpEvents.id })
    .from(xpEvents)
    .where(
      ideaId
        ? and(eq(xpEvents.userId, userId), eq(xpEvents.eventType, eventType), eq(xpEvents.ideaId, ideaId))
        : and(eq(xpEvents.userId, userId), eq(xpEvents.eventType, eventType))
    )
    .limit(1);

  if (existing.length > 0) return false;

  await db.insert(xpEvents).values({ userId, eventType, ideaId: ideaId ?? null, xpAwarded: Math.max(0, delta) });
  await awardXp(userId, delta);
  return true;
}

/** Award XP with private/public sub-total tracking. */
export async function awardXpForDomain(
  userId: string, delta: number, domain: "private" | "public",
  eventType: string, ideaId?: string, idempotent = false
): Promise<boolean> {
  if (idempotent) {
    const wasAwarded = await awardXpIdempotent(userId, eventType, delta, ideaId);
    if (!wasAwarded) return false;
  } else {
    await awardXp(userId, delta);
  }
  if (delta > 0) {
    const col = domain === "private" ? users.privateXp : users.publicXp;
    await db.update(users).set({ [domain === "private" ? "privateXp" : "publicXp"]: sql`${col} + ${delta}` }).where(eq(users.id, userId));
  }
  return true;
}
