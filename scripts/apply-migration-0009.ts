import "dotenv/config";
import { readFileSync } from "fs";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const migration = readFileSync("./drizzle/0009_multi_round.sql", "utf8");
  const stmts = migration.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    await sql.unsafe(stmt);
    console.log("OK:", stmt.slice(0, 70));
  }
  await sql.end();
  process.exit(0);
}

main();
