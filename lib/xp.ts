import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getTierNameFromXp } from "@/lib/tier-engine";

export async function awardXp(userId: string, delta: number) {
    await db
        .update(users)
        .set({ xp: sql`${users.xp} + ${delta}` })
        .where(eq(users.id, userId));

    const [user] = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, userId));

    if (!user) return;

    const newTier = getTierNameFromXp(user.xp);
    await db
        .update(users)
        .set({ tier: newTier })
        .where(eq(users.id, userId));

    try {
        const { checkAndAwardBadges } = await import("@/app/actions/badgeActions");
        await checkAndAwardBadges(userId);
    } catch { /* badge errors should not block XP award */ }
}
