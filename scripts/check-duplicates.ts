import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const dup1 = await sql`
    SELECT debate_id, slot_index, COUNT(*)
    FROM debate_participants
    GROUP BY debate_id, slot_index
    HAVING COUNT(*) > 1`;
  console.log("debate_participants duplicates:", dup1.length === 0 ? "NONE — safe to apply uniqueIndex" : dup1);

  const dup2 = await sql`
    SELECT debate_id, agent_id, round, COUNT(*)
    FROM debate_turns
    WHERE agent_id IS NOT NULL
    GROUP BY debate_id, agent_id, round
    HAVING COUNT(*) > 1`;
  console.log("debate_turns duplicates:", dup2.length === 0 ? "NONE — safe to apply uniqueIndex" : dup2);

  await sql.end();
  process.exit(0);
}

main();
