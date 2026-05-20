import { NextRequest, NextResponse }  from "next/server";
import {
  getDebateByShareToken,
  getDebateParticipants,
  getDebateTurns,
} from "@/lib/agents/debate-helpers";
import { getAgent }                   from "@/lib/agents/personas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const debate = await getDebateByShareToken(token);

  if (!debate || debate.status !== "archived") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const participants = await getDebateParticipants(debate.id);
  const turns        = await getDebateTurns(debate.id);

  const participantDetails = participants.map(p => {
    const agent = getAgent(p.agentId);
    return {
      agentId:   p.agentId,
      name:      agent?.name   ?? p.agentId,
      avatar:    agent?.avatar ?? null,
      slotIndex: p.slotIndex,
    };
  });

  return NextResponse.json({
    debate: {
      id:               debate.id,
      originalInput:    debate.originalInput,
      title:            debate.title,
      debateMode:       debate.debateMode,
      judgeReasoning:   debate.judgeReasoning,
      archivistSummary: debate.archivistSummary,
      archivedAt:       debate.archivedAt,
    },
    participants: participantDetails,
    turns: turns.map(t => ({
      agentId:   t.agentId,
      content:   t.content,
      createdAt: t.createdAt,
    })),
  });
}
