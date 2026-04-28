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

  // Reset failed post_idea rows to pending so the next tick retries them
  await db.execute(sql`
    UPDATE ai_queue
    SET    status        = 'pending',
           error_message = NULL,
           executed_at   = NULL,
           scheduled_for = NOW()
    WHERE  action_type = 'post_idea'
      AND  status      = 'failed'
  `);
  console.log("Failed post_idea rows reset to pending");

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
