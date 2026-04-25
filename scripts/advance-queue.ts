// Moves all pending post_idea rows' scheduled_for to now so the next tick processes them.
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

  const result = await db.execute(sql`
    UPDATE ai_queue
    SET    scheduled_for = NOW()
    WHERE  action_type = 'post_idea'
      AND  status      = 'pending'
  `);
  console.log("Rows advanced:", (result as unknown as { count?: number }).count ?? "done");

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
