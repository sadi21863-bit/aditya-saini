import "dotenv/config";
import { db } from "@/db";
import { debates, debateParticipants, debateTurns, debateQuestions, aiQueue } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const id = process.argv[2];
if (!id) { console.error("Usage: npx tsx scripts/delete-debate-by-id.ts <id>"); process.exit(1); }

async function main() {
  await db.delete(aiQueue).where(
    sql`${aiQueue.promptContext}->>'debateId' = ${id}`
  ).catch(() => {});
  await db.delete(debateParticipants).where(eq(debateParticipants.debateId, id));
  await db.delete(debateTurns).where(eq(debateTurns.debateId, id));
  await db.delete(debateQuestions).where(eq(debateQuestions.debateId, id));
  await db.delete(debates).where(eq(debates.id, id));
  console.log(`Deleted debate ${id}`);
  process.exit(0);
}

main();
