import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueDailyIdeas } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueDailyIdeas();
  } catch (err) {
    console.error("[cron/seed-ideas] queueDailyIdeas failed:", err);
    return Response.json({ error: "Failed to queue daily ideas" }, { status: 500 });
  }

  try {
    const result = await processQueue(5);
    return Response.json({ success: true, queued: "post_idea", count: 3, processed: result });
  } catch (err) {
    console.error("[cron/seed-ideas] processQueue failed:", err);
    return Response.json({ success: true, queued: "post_idea", count: 3, processed: 0, processingError: String(err) });
  }
}
