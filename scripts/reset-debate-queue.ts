import "dotenv/config";
import { db } from "@/db";
import { aiQueue, debates } from "@/db/schema";
import { sql, desc, ne } from "drizzle-orm";

async function main() {
  const recentDebate = await db.select({ id: debates.id })
    .from(debates).orderBy(desc(debates.createdAt)).limit(1);
  const debateId = recentDebate[0]?.id;
  if (!debateId) { console.log("No debates found"); process.exit(0); }

  const result = await db.update(aiQueue)
    .set({ status: "pending", executedAt: null, errorMessage: null })
    .where(sql`${aiQueue.promptContext}->>'debateId' = ${debateId} AND ${aiQueue.status} != 'completed'`);

  console.log(`Reset queue items for debate ${debateId}`);
  process.exit(0);
}

main();
