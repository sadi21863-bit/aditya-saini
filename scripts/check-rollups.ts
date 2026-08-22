import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function check() {
  const archives = await sql.unsafe("SELECT date, status FROM ai_lab_archives ORDER BY date DESC LIMIT 30");
  console.log("Daily archives:", archives.length);
  archives.forEach((a: any) => console.log("  " + a.date + " [" + a.status + "]"));

  const weeklies = await sql.unsafe("SELECT period_start, period_end, status FROM ai_lab_rollups WHERE period_type = 'weekly' ORDER BY period_start DESC");
  console.log("Weekly rollups:", weeklies.length);
  weeklies.forEach((r: any) => console.log("  " + r.period_start + " -> " + r.period_end + " [" + r.status + "]"));

  const monthlies = await sql.unsafe("SELECT period_start, period_end, status FROM ai_lab_rollups WHERE period_type = 'monthly' ORDER BY period_start DESC");
  console.log("Monthly rollups:", monthlies.length);
  monthlies.forEach((r: any) => console.log("  " + r.period_start + " -> " + r.period_end + " [" + r.status + "]"));

  await sql.end();
}

check().catch((e) => { console.error(e.message); process.exit(1); });
