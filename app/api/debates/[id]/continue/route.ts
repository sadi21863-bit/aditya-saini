import { NextRequest, NextResponse, after } from "next/server";
import { auth }                             from "@/lib/auth";
import { db }                               from "@/db";
import { debates, aiQueue }                 from "@/db/schema";
import { eq, and }                          from "drizzle-orm";
import { getDebateParticipants }            from "@/lib/agents/debate-helpers";
import { dispatchQueueProcessor }           from "@/lib/agents/dispatch-queue";

export const maxDuration = 10;

type Params = { id: string };

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: debateId } = await params;

  const [debate] = await db.select().from(debates)
    .where(and(eq(debates.id, debateId), eq(debates.userId, session.user.id)))
    .limit(1);

  if (!debate) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (debate.status !== "archived") {
    return NextResponse.json({ error: "Debate must be archived before starting Round 2." }, { status: 409 });
  }
  if (debate.roundCount >= 2) {
    return NextResponse.json({ error: "Maximum 2 rounds reached." }, { status: 429 });
  }

  const participants = await getDebateParticipants(debateId);
  if (participants.length < 2) {
    return NextResponse.json({ error: "Participants not found." }, { status: 500 });
  }

  await db.update(debates)
    .set({ status: "in_progress", roundCount: 2, updatedAt: new Date() })
    .where(eq(debates.id, debateId));

  await db.insert(aiQueue).values({
    agentId:       participants[0].agentId,
    actionType:    "debate_turn",
    promptContext: { debateId, slot: 0, round: 2 },
    priority:      1,
    scheduledFor:  new Date(),
    status:        "pending",
  });

  after(async () => { await dispatchQueueProcessor(); });

  return NextResponse.json({ status: "started", debateId });
}
