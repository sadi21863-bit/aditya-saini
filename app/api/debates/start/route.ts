import { NextRequest, NextResponse, after }     from "next/server";
import { auth }                                from "@/lib/auth";
import { db }                                  from "@/db";
import { debates, aiQueue }                    from "@/db/schema";
import { eq, and, gte, count, ne }             from "drizzle-orm";
import { z }                                   from "zod";
import { getDebateParticipants, getDebateTurns } from "@/lib/agents/debate-helpers";
import { dispatchQueueProcessor }              from "@/lib/agents/dispatch-queue";
import { startOfToday }                        from "@/lib/time";

export const maxDuration = 10;

const BodySchema = z.object({ debateId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const userId = session.user.id;

  const body   = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid debateId." }, { status: 400 });
  }
  const { debateId } = parsed.data;

  // Daily limit — 5 full debates/day
  const startOfDay = startOfToday();
  const [limitRow] = await db
    .select({ n: count() })
    .from(debates)
    .where(and(
      eq(debates.userId, userId),
      eq(debates.judgeVerdict, "full_debate"),
      ne(debates.status, "abandoned"),
      gte(debates.createdAt, startOfDay),
    ));
  if (Number(limitRow?.n ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Debate limit reached for today (5/day). Check back tomorrow." },
      { status: 429 },
    );
  }

  const [debate] = await db.select().from(debates)
    .where(and(eq(debates.id, debateId), eq(debates.userId, userId)))
    .limit(1);

  if (!debate)                               return NextResponse.json({ error: "Not found." },            { status: 404 });
  if (debate.judgeVerdict !== "full_debate") return NextResponse.json({ error: "Not routed to debate." }, { status: 400 });
  if (debate.status !== "in_progress")       return NextResponse.json({ error: "Debate already closed." },{ status: 400 });

  const existingTurns = await getDebateTurns(debateId);
  if (existingTurns.length > 0) {
    return NextResponse.json({ status: "already_started", debateId });
  }

  const participants = await getDebateParticipants(debateId);
  if (participants.length < 2) {
    return NextResponse.json({ error: "Participants not set." }, { status: 400 });
  }

  await db.insert(aiQueue).values({
    agentId:       participants[0].agentId,
    actionType:    "debate_turn",
    promptContext: { debateId, slot: 0 },
    priority:      1,   // same as AI Lab urgent items — processed first in tick
    scheduledFor:  new Date(),
    status:        "pending",
  });

  // Dispatch GHA workflow_dispatch to process the queue in GitHub Actions.
  // GHA has no function timeout — all 3 passes (Agent A → B → Archive) complete
  // there without hitting Vercel's 10s limit. Starts in ~30-60s.
  // The 5-minute cron is the fallback if dispatch fails silently.
  after(async () => { await dispatchQueueProcessor(); });

  return NextResponse.json({ status: "started", debateId });
}
