import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiLabOptouts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const BodySchema = z.object({
  agentId: z.string().min(1),
  optout:  z.boolean(),
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
  const { agentId, optout } = parsed.data;

  if (optout) {
    await db
      .insert(aiLabOptouts)
      .values({ userId, targetType: "agent", targetId: agentId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(aiLabOptouts)
      .where(
        and(
          eq(aiLabOptouts.userId, userId),
          eq(aiLabOptouts.targetType, "agent"),
          eq(aiLabOptouts.targetId, agentId),
        ),
      );
  }

  return NextResponse.json({ ok: true });
}
