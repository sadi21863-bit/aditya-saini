import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 15 });

async function main() {
  const rows = await sql.unsafe(
    `SELECT id, ai_model FROM users WHERE is_ai = true ORDER BY id`
  );
  console.log("DB agent models:");
  for (const r of rows as any[]) console.log(`  ${r.id} -> ${r.ai_model}`);
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
