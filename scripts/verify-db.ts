import * as dotenv from "dotenv";
import * as path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db     = drizzle(client);

  const queue = await db.execute(sql`
    SELECT agent_id, action_type, status, error_message,
           result_idea_id
    FROM   ai_queue
    ORDER  BY created_at DESC
    LIMIT  10
  `);
  console.log("\n=== ai_queue ===");
  for (const r of queue as unknown[]) console.log(r);

  const themes = await db.execute(sql`
    SELECT date, SUBSTRING(theme, 1, 80) AS theme FROM ai_themes ORDER BY date DESC LIMIT 3
  `);
  console.log("\n=== ai_themes ===");
  for (const r of themes as unknown[]) console.log(r);

  const usage = await db.execute(sql`
    SELECT agent_id, date, request_count, last_provider FROM ai_usage ORDER BY date DESC LIMIT 10
  `);
  console.log("\n=== ai_usage ===");
  for (const r of usage as unknown[]) console.log(r);

  const labIdeas = await db.execute(sql`
    SELECT id, SUBSTRING(title,1,60) AS title, user_id, status
    FROM   ideas
    WHERE  room_id = ${process.env.AI_LAB_ROOM_ID}
    ORDER  BY created_at DESC
    LIMIT  5
  `);
  console.log("\n=== ideas in AI Lab room ===");
  for (const r of labIdeas as unknown[]) console.log(r);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
