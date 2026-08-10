import { db } from "@/db";
import { debates, debateParticipants, debateTurns } from "@/db/schema";
import { eq } from "drizzle-orm";

const VALID_PARTICIPANT_IDS = [
  "ai_llama", "ai_gpt_oss", "ai_scout", "ai_maverick",
];

export interface DebateState {
  debateId: string;
  status: string;
  roundCount: number;
  maxRounds: number;
  pushbackCount: number;
  maxPushbacks: number;
  participantCount: number;
  lastRoundComplete: boolean;
}

export async function loadDebateState(debateId: string): Promise<DebateState | null> {
  const debate = await db.query.debates.findFirst({
    where: eq(debates.id, debateId),
  });

  if (!debate) return null;

  const participants = await db.query.debateParticipants.findMany({
    where: eq(debateParticipants.debateId, debateId),
  });

  const turns = await db.query.debateTurns.findMany({
    where: eq(debateTurns.debateId, debateId),
  });

  const turnsThisRound = turns.filter((t) => t.round === debate.roundCount);

  return {
    debateId,
    status: debate.status,
    roundCount: debate.roundCount,
    maxRounds: debate.maxRounds,
    pushbackCount: debate.pushbackCount,
    maxPushbacks: debate.maxPushbacks,
    participantCount: participants.length,
    lastRoundComplete: turnsThisRound.length >= 2,
  };
}

export function validateAgentId(id: string): string {
  return VALID_PARTICIPANT_IDS.includes(id) ? id : "ai_llama";
}

export function canPushback(state: DebateState): boolean {
  return (
    state.status === "awaiting_pushback" &&
    state.pushbackCount < state.maxPushbacks &&
    state.roundCount < state.maxRounds
  );
}

export function canTriggerVerdict(state: DebateState): boolean {
  return state.status === "awaiting_pushback" && state.lastRoundComplete;
}
