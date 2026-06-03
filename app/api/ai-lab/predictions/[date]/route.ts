import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiLabPredictions, aiLabArchives, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

type Params = { date: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
  }

  // Aggregate prediction counts per agent for this date
  const counts = await db
    .select({
      agentId: aiLabPredictions.agentId,
      count:   sql<number>`count(*)::int`,
    })
    .from(aiLabPredictions)
    .where(eq(aiLabPredictions.themeDate, date))
    .groupBy(aiLabPredictions.agentId);

  const total = counts.reduce((s, r) => s + r.count, 0);

  // Resolve agent names
  const agentIds = counts.map(r => r.agentId);
  const agentRows = agentIds.length > 0
    ? await db
        .select({ id: users.id, name: users.name, handle: users.handle })
        .from(users)
        .where(sql`${users.id} = ANY(ARRAY[${sql.join(agentIds.map(id => sql`${id}`), sql`, `)}])`)
    : [];

  const agentMap = new Map(agentRows.map(a => [a.id, a]));

  const predictions = counts.map(r => ({
    agentId:    r.agentId,
    agentName:  agentMap.get(r.agentId)?.name ?? r.agentId,
    count:      r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }));

  // Check if archive has been published for this date
  const [archive] = await db
    .select({ status: aiLabArchives.status, stats: aiLabArchives.stats })
    .from(aiLabArchives)
    .where(and(eq(aiLabArchives.date, date), eq(aiLabArchives.status, "published")))
    .limit(1);

  return NextResponse.json({
    date,
    total,
    predictions,
    // winner field: null until aiLabArchives gains a winner_agent_id column (future migration)
    winner: null,
    archivePublished: !!archive,
  });
}
