import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueMonthlyRollup } from "@/lib/agents/scheduler";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueMonthlyRollup();
    return Response.json({ success: true, queued: "rollup_month" });
  } catch (err) {
    console.error("[cron/rollup-monthly]", err);
    return Response.json({ error: "Failed to queue monthly rollup" }, { status: 500 });
  }
}
