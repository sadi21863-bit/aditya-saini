import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { debates, debatePushbacks, debateParticipants, aiQueue } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { dispatchQueueProcessor } from "@/lib/agents/dispatch-queue";

export const maxDuration = 10;

const PushbackSchema = z.object({
  debateId: z.string().uuid(),
  text: z.string().min(10).max(1000),
  targetAgentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: z.infer<typeof PushbackSchema>;
  try {
    body = PushbackSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 1. Load debate
  const [debate] = await db
    .select()
    .from(debates)
    .where(
      and(eq(debates.id, body.debateId), eq(debates.userId, session.user.id))
    )
    .limit(1);

  if (!debate) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }

  // 2. Validate state
  if (debate.status !== "awaiting_pushback") {
    return NextResponse.json(
      { error: "Debate is not accepting pushbacks." },
      { status: 409 }
    );
  }

  if (debate.pushbackCount >= debate.maxPushbacks) {
    return NextResponse.json(
      { error: "Maximum pushbacks reached." },
      { status: 429 }
    );
  }

  if (debate.roundCount >= debate.maxRounds) {
    return NextResponse.json(
      { error: "Maximum rounds reached." },
      { status: 429 }
    );
  }

  // 3. Store pushback
  await db.insert(debatePushbacks).values({
    debateId: body.debateId,
    round: debate.roundCount,
    userId: session.user.id,
    text: body.text,
    agentId: body.targetAgentId ?? null,
  });

  // 4. Update debate state
  const nextRound = debate.roundCount + 1;
  await db.update(debates).set({
    status: "in_progress",
    roundCount: nextRound,
    pushbackCount: debate.pushbackCount + 1,
    updatedAt: new Date(),
  });

  // 5. Queue next round (slot 0 → slot 1)
  const participants = await db
    .select()
    .from(debateParticipants)
    .where(eq(debateParticipants.debateId, body.debateId))
    .orderBy(asc(debateParticipants.slotIndex));

  if (participants.length < 2) {
    return NextResponse.json({ error: "Debate participants not found." }, { status: 500 });
  }

  await db.insert(aiQueue).values({
    agentId:       participants[0].agentId,
    actionType:    "debate_turn",
    promptContext: {
      debateId: body.debateId,
      slot: 0,
      round: nextRound,
      maxRounds: debate.maxRounds,
      maxPushbacks: debate.maxPushbacks,
      pushbacksUsed: debate.pushbackCount + 1,
      pushbackText: body.text,
      pushbackTarget: body.targetAgentId,
    },
    priority:      1,
    scheduledFor:  new Date(),
    status:        "pending",
  });

  after(async () => {
    await dispatchQueueProcessor();
  });

  return NextResponse.json({
    status: "in_progress",
    round: nextRound,
    debateId: body.debateId,
  });
}
