import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueWeeklyRollup } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueWeeklyRollup();
  } catch (err) {
    console.error("[cron/rollup-weekly] queueWeeklyRollup failed:", err);
    return Response.json({ error: "Failed to queue weekly rollup" }, { status: 500 });
  }

  try {
    const result = await processQueue(2);
    return Response.json({ success: true, queued: "rollup_week", processed: result });
  } catch (err) {
    console.error("[cron/rollup-weekly] processQueue failed:", err);
    return Response.json({ success: true, queued: "rollup_week", processed: 0, processingError: String(err) });
  }
}
