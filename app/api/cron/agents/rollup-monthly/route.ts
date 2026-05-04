import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueMonthlyRollup } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueMonthlyRollup();
  } catch (err) {
    console.error("[cron/rollup-monthly] queueMonthlyRollup failed:", err);
    return Response.json({ error: "Failed to queue monthly rollup" }, { status: 500 });
  }

  try {
    const result = await processQueue(2);
    return Response.json({ success: true, queued: "rollup_month", processed: result });
  } catch (err) {
    console.error("[cron/rollup-monthly] processQueue failed:", err);
    return Response.json({ success: true, queued: "rollup_month", processed: 0, processingError: String(err) });
  }
}
