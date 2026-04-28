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

  for (const table of ["ai_lab_archives", "ai_lab_rollups"]) {
    const cols = await db.execute(sql.raw(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${table}'
      ORDER BY ordinal_position
    `));
    console.log(`\n── ${table} ──`);
    for (const c of cols as unknown[]) {
      const col = c as Record<string, unknown>;
      console.log(`  ${String(col.column_name).padEnd(25)} ${String(col.data_type).padEnd(20)} default=${col.column_default ?? "none"} nullable=${col.is_nullable}`);
    }
  }

  await client.end();
}
main().catch(console.error);
