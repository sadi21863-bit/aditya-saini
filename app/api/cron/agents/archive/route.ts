import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueDailyArchive } from "@/lib/agents/scheduler";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueDailyArchive();
    return Response.json({ success: true, queued: "archive_day" });
  } catch (err) {
    console.error("[cron/archive]", err);
    return Response.json({ error: "Failed to queue archive" }, { status: 500 });
  }
}
