import "dotenv/config";
import { db } from "@/db";
import { debates, debateParticipants, aiQueue } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";

async function main() {
  const [latest] = await db.select({ id: debates.id })
    .from(debates).orderBy(desc(debates.createdAt)).limit(1);
  if (!latest) { console.log("No debates found"); process.exit(1); }

  const participants = await db.select()
    .from(debateParticipants)
    .where(eq(debateParticipants.debateId, latest.id));
  console.log("Current participants:", JSON.stringify(participants));

  // Swap ai_llama → ai_gpt_oss for slot 0
  for (const p of participants) {
    if (p.agentId === "ai_llama") {
      await db.update(debateParticipants)
        .set({ agentId: "ai_gpt_oss" })
        .where(eq(debateParticipants.id, p.id));
      console.log(`Swapped slot ${p.slotIndex}: ai_llama → ai_gpt_oss`);
    }
  }

  // Reset the stuck queue item to pending
  await db.update(aiQueue)
    .set({ status: "pending", executedAt: null, errorMessage: null })
    .where(sql`${aiQueue.promptContext}->>'debateId' = ${latest.id} AND ${aiQueue.status} != 'completed'`);
  console.log("Queue item reset to pending");
  process.exit(0);
}

main();
