import "dotenv/config";
import { db } from "@/db";
import { aiQueue, debates } from "@/db/schema";
import { sql, desc } from "drizzle-orm";

async function main() {
  const recentDebate = await db.select({ id: debates.id, status: debates.status, title: debates.title })
    .from(debates).orderBy(desc(debates.createdAt)).limit(1);
  console.log("Latest debate:", JSON.stringify(recentDebate[0]));

  const debateId = recentDebate[0]?.id;
  if (!debateId) { process.exit(0); }

  const q = await db.select({
    id: aiQueue.id,
    actionType: aiQueue.actionType,
    status: aiQueue.status,
    priority: aiQueue.priority,
    scheduledFor: aiQueue.scheduledFor,
    executedAt: aiQueue.executedAt,
  }).from(aiQueue)
    .where(sql`${aiQueue.promptContext}->>'debateId' = ${debateId}`)
    .orderBy(desc(aiQueue.scheduledFor));

  console.log("Queue items:", JSON.stringify(q, null, 2));
  process.exit(0);
}

main();
