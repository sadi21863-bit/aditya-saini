import "dotenv/config";
import { db } from "@/db";
import { aiQueue } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db.update(aiQueue)
    .set({ agentId: "ai_scout", status: "pending", executedAt: null, errorMessage: null })
    .where(eq(aiQueue.id, "437fc7e4-7e12-4cf9-b2a9-de60b501d6c0"))
    .returning({ id: aiQueue.id, agentId: aiQueue.agentId, status: aiQueue.status });
  console.log("Updated:", JSON.stringify(result));
  process.exit(0);
}

main();
