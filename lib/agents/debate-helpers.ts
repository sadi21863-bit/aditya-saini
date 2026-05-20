import { db } from "@/db";
import {
  debates, debateParticipants, debateTurns,
  type Debate, type DebateParticipant, type DebateTurn,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getDebateById(id: string): Promise<Debate | undefined> {
  const [row] = await db.select().from(debates).where(eq(debates.id, id)).limit(1);
  return row;
}

export async function getDebateByShareToken(token: string): Promise<Debate | undefined> {
  const [row] = await db.select().from(debates)
    .where(eq(debates.shareToken, token)).limit(1);
  return row;
}

export async function getDebateParticipants(debateId: string): Promise<DebateParticipant[]> {
  return db.select().from(debateParticipants)
    .where(eq(debateParticipants.debateId, debateId))
    .orderBy(asc(debateParticipants.slotIndex));
}

export async function getDebateTurns(debateId: string): Promise<DebateTurn[]> {
  return db.select().from(debateTurns)
    .where(eq(debateTurns.debateId, debateId))
    .orderBy(asc(debateTurns.createdAt));
}
