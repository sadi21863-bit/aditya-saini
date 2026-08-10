import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { debates, aiQueue } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { dispatchQueueProcessor } from "@/lib/agents/dispatch-queue";

export const maxDuration = 10;

type Params = { id: string };

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: debateId } = await params;

  const [debate] = await db
    .select()
    .from(debates)
    .where(
      and(eq(debates.id, debateId), eq(debates.userId, session.user.id))
    )
    .limit(1);

  if (!debate) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }

  if (debate.status !== "awaiting_pushback") {
    return NextResponse.json(
      { error: "Debate is not in a state where verdict can be requested." },
      { status: 409 }
    );
  }

  // Update debate state
  await db.update(debates).set({
    status: "final_verdict",
    updatedAt: new Date(),
  });

  // Queue the final verdict
  await db.insert(aiQueue).values({
    agentId:       "ai_archivist",
    actionType:    "debate_final_verdict",
    promptContext: { debateId },
    priority:      1,
    scheduledFor:  new Date(),
    status:        "pending",
  });

  after(async () => {
    await dispatchQueueProcessor();
  });

  return NextResponse.json({ status: "final_verdict" });
}
