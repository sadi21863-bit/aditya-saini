import "dotenv/config";
import { db } from "@/db";
import { debates, debateParticipants, debateTurns, debateQuestions, aiQueue } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

async function main() {
  const doDelete = process.argv.includes("--delete");

  const rows = await db
    .select({ id: debates.id, title: debates.title, status: debates.status, createdAt: debates.createdAt })
    .from(debates)
    .orderBy(sql`${debates.createdAt} DESC`)
    .limit(20);

  console.log("\nRecent debates:");
  rows.forEach((r, i) => console.log(`  ${i + 1}. [${r.status}] ${r.title} (${r.id})`));

  if (rows.length === 0) {
    console.log("No debates found.");
    process.exit(0);
  }

  if (!doDelete) {
    console.log("\nDry run — pass --delete to actually delete.");
    process.exit(0);
  }

  const ids = rows.map(r => r.id);

  // Cancel any pending queue items first
  await db.delete(aiQueue).where(
    sql`${aiQueue.promptContext}->>'debateId' = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}::text`), sql`, `)}])`
  ).catch(() => {});

  // Delete child rows then parent
  await db.delete(debateParticipants).where(inArray(debateParticipants.debateId, ids));
  await db.delete(debateTurns).where(inArray(debateTurns.debateId, ids));
  await db.delete(debateQuestions).where(inArray(debateQuestions.debateId, ids));
  await db.delete(debates).where(inArray(debates.id, ids));

  console.log(`\nDeleted ${ids.length} debate(s) and their child rows.`);
  process.exit(0);
}

main();
