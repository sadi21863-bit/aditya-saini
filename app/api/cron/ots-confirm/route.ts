import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { genesisHashes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkConfirmation } from "@/lib/open-timestamps";
import { awardXpForDomain } from "@/lib/xp";
import { XP_EVENTS } from "@/lib/tier-engine";
import { createNotification } from "@/app/actions/notificationActions";

// GET /api/cron/ots-confirm
// Called hourly. Checks pending OTS proofs for Bitcoin confirmation.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await db
    .select()
    .from(genesisHashes)
    .where(eq(genesisHashes.confirmed, false));

  let confirmedCount = 0;

  for (const entry of pending) {
    if (!entry.otsBlobUrl) continue;

    const isConfirmed = await checkConfirmation(entry.otsBlobUrl);
    if (!isConfirmed) continue;

    await db
      .update(genesisHashes)
      .set({ confirmed: true })
      .where(eq(genesisHashes.id, entry.id));

    // Fetch idea owner to award XP
    const { ideas } = await import("@/db/schema");
    const [idea] = await db
      .select({ userId: ideas.userId, title: ideas.title })
      .from(ideas)
      .where(eq(ideas.id, entry.ideaId));

    if (idea?.userId) {
      await awardXpForDomain(
        idea.userId,
        XP_EVENTS.GENESIS_HASH_CONFIRMED,
        "private",
        "GENESIS_HASH_CONFIRMED",
        entry.ideaId,
        true // idempotent
      );

      await createNotification({
        userId: idea.userId,
        type: "genesis_confirmed",
        body: `🔒 Your idea "${idea.title}" has been Bitcoin-anchored via OpenTimestamps.`,
        link: `/idea/${entry.ideaId}`,
      });
    }

    confirmedCount++;
  }

  return NextResponse.json({ checked: pending.length, confirmed: confirmedCount, timestamp: new Date().toISOString() });
}
