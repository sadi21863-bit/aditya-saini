import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ideas } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

// GET /api/cron/leaderboard
// Called by Vercel cron daily at midnight. Recalculates all user tiers.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recalculate tiers for all users based on current XP
  await db.execute(sql`
    UPDATE users SET tier =
      CASE
        WHEN xp >= 1500 THEN 'pioneer'
        WHEN xp >= 500  THEN 'architect'
        WHEN xp >= 100  THEN 'builder'
        ELSE 'explorer'
      END
  `);

  return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}
