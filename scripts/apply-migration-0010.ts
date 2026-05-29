import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  // Add FK from rooms.pinned_idea_id → ideas.id with ON DELETE SET NULL.
  // Applied via raw SQL because rooms↔ideas is a circular reference that
  // Drizzle schema.ts cannot represent without losing TypeScript type inference.
  await sql`
    ALTER TABLE rooms
    ADD CONSTRAINT rooms_pinned_idea_id_ideas_id_fk
    FOREIGN KEY (pinned_idea_id) REFERENCES ideas(id) ON DELETE SET NULL
  `;
  console.log("OK: rooms.pinned_idea_id FK added");
  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  // If constraint already exists, that's fine
  if ((err as { code?: string }).code === "42710") {
    console.log("FK already exists — skipping");
    process.exit(0);
  }
  console.error(err.message);
  process.exit(1);
});
