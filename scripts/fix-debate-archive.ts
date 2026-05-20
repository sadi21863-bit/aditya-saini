import "dotenv/config";
import { db } from "@/db";
import { debates, debateParticipants, debateTurns, aiQueue } from "@/db/schema";
import { eq, desc, sql, asc } from "drizzle-orm";

async function main() {
  const [latest] = await db.select({ id: debates.id, status: debates.status })
    .from(debates).orderBy(desc(debates.createdAt)).limit(1);
  if (!latest) { console.log("No debates"); process.exit(1); }
  const debateId = latest.id;
  console.log("Debate:", debateId, "status:", latest.status);

  const turns = await db.select({ id: debateTurns.id, agentId: debateTurns.agentId })
    .from(debateTurns).where(eq(debateTurns.debateId, debateId))
    .orderBy(asc(debateTurns.createdAt));
  console.log("Turns:", turns.map(t => t.agentId));

  const participants = await db.select()
    .from(debateParticipants).where(eq(debateParticipants.debateId, debateId))
    .orderBy(asc(debateParticipants.slotIndex));
  console.log("Participants (by slot):", participants.map(p => `slot${p.slotIndex}=${p.agentId}`));

  // turns[0] = Agent A, turns[1] = Agent B
  if (turns.length >= 2) {
    const slotBParticipant = participants.find(p => p.slotIndex === 1);
    if (slotBParticipant && slotBParticipant.agentId !== turns[1].agentId) {
      await db.update(debateParticipants)
        .set({ agentId: turns[1].agentId })
        .where(eq(debateParticipants.id, slotBParticipant.id));
      console.log(`Fixed slot 1: ${slotBParticipant.agentId} → ${turns[1].agentId}`);
    }
  }

  // Insert a fresh debate_archive queue item
  const archivistId = "ai_archivist";
  await db.insert(aiQueue).values({
    agentId:       archivistId,
    actionType:    "debate_archive",
    promptContext: { debateId },
    priority:      1,
    scheduledFor:  new Date(),
    status:        "pending",
  });
  console.log("New debate_archive queue item inserted");
  process.exit(0);
}

main();
