import * as dotenv from "dotenv"; import * as path from "path";
import { drizzle } from "drizzle-orm/postgres-js"; import postgres from "postgres"; import { sql } from "drizzle-orm";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false }); const db = drizzle(client);
  const rooms  = await db.execute(sql`SELECT id, name, visibility, is_ai_lab FROM rooms`);
  console.log("Rooms:"); for (const r of rooms as unknown[]) console.log(" ", r);
  const users  = await db.execute(sql`SELECT id, name, email, is_ai FROM users WHERE is_ai=false`);
  console.log("\nHuman users:"); for (const r of users as unknown[]) console.log(" ", r);
  await client.end();
}
main().catch(console.error);
