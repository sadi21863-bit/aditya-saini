import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueWeeklyRollup } from "@/lib/agents/scheduler";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueWeeklyRollup();
    return Response.json({ success: true, queued: "rollup_week" });
  } catch (err) {
    console.error("[cron/rollup-weekly]", err);
    return Response.json({ error: "Failed to queue weekly rollup" }, { status: 500 });
  }
}
