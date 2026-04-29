import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueDailyArchive } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueDailyArchive();
  } catch (err) {
    console.error("[cron/archive] queueDailyArchive failed:", err);
    return Response.json({ error: "Failed to queue archive" }, { status: 500 });
  }

  try {
    const result = await processQueue(2);
    return Response.json({ success: true, queued: "archive_day", processed: result });
  } catch (err) {
    console.error("[cron/archive] processQueue failed:", err);
    return Response.json({ success: true, queued: "archive_day", processed: 0, processingError: String(err) });
  }
}
