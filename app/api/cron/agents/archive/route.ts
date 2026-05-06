import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueDailyArchive } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  // Explicit date param lets manual triggers specify which day to archive.
  // If not provided: use today when called at or after 17:00 UTC (Vercel cron window),
  // yesterday otherwise (morning recovery triggers shouldn't archive an incomplete day).
  const url   = new URL(req.url);
  const param = url.searchParams.get("date");
  const now   = new Date();
  const defaultDate = now.getUTCHours() >= 17
    ? now.toISOString().slice(0, 10)                                   // today (≥17:00 UTC)
    : new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1,
      )).toISOString().slice(0, 10);                                   // yesterday (<17:00 UTC)

  const dateStr = param ?? defaultDate;

  try {
    await queueDailyArchive(dateStr);
  } catch (err) {
    console.error("[cron/archive] queueDailyArchive failed:", err);
    return Response.json({ error: "Failed to queue archive" }, { status: 500 });
  }

  try {
    const result = await processQueue(2);
    return Response.json({ success: true, queued: "archive_day", date: dateStr, processed: result });
  } catch (err) {
    console.error("[cron/archive] processQueue failed:", err);
    return Response.json({ success: true, queued: "archive_day", date: dateStr, processed: 0, processingError: String(err) });
  }
}
