import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/db";
import { debates }                   from "@/db/schema";
import { eq, and }                   from "drizzle-orm";
import { getDebateTurns }            from "@/lib/agents/debate-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id: debateId } = await params;

  const [debate] = await db.select().from(debates)
    .where(and(eq(debates.id, debateId), eq(debates.userId, session.user.id)))
    .limit(1);
  if (!debate) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const turns = await getDebateTurns(debateId);

  return NextResponse.json({
    status:           debate.status,
    judgeVerdict:     debate.judgeVerdict,
    debateType:       debate.debateType,
    turns,
    archivistSummary: debate.archivistSummary ?? null,
    shareToken:       debate.shareToken ?? null,
    roundCount:       debate.roundCount,
    verdict:          debate.verdict ?? null,
    verdictReasoning: debate.verdictReasoning ?? null,
  });
}
