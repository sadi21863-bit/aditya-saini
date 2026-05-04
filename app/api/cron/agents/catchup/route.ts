import { checkCronAuth } from "@/lib/agents/cron-auth";
import { processQueue, resetStuckQueueItems } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const recovered = await resetStuckQueueItems();
    if (recovered > 0) {
      console.log(`[cron/catchup] Reset ${recovered} stuck in_progress row(s) → pending`);
    }
    const result = await processQueue(20);
    return Response.json({ success: true, recovered, processed: result });
  } catch (err) {
    console.error("[cron/catchup] failed:", err);
    return Response.json({ error: "Catch-up processing failed", detail: String(err) }, { status: 500 });
  }
}
