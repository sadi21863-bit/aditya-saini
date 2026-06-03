import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiLabPredictions, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const BodySchema = z.object({
  agentId:   z.string().min(1),
  themeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body   = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { agentId, themeDate } = parsed.data;

  // themeDate must be today (UTC)
  const todayUTC = new Date().toISOString().slice(0, 10);
  if (themeDate !== todayUTC) {
    return NextResponse.json({ error: "Predictions must be for today's date." }, { status: 400 });
  }

  // Verify agentId is a real AI agent
  const [agent] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.id, agentId), eq(users.isAi, true)))
    .limit(1);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  try {
    await db.insert(aiLabPredictions).values({ userId, themeDate, agentId });
  } catch {
    // Unique constraint violation — user already predicted today
    return NextResponse.json({ error: "You have already made a prediction today." }, { status: 409 });
  }

  return NextResponse.json({
    success:    true,
    prediction: { agentId, agentName: agent.name },
  });
}
