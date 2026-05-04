import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueThemeSelection } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueThemeSelection();
  } catch (err) {
    console.error("[cron/theme] queueThemeSelection failed:", err);
    return Response.json({ error: "Failed to queue theme selection" }, { status: 500 });
  }

  try {
    const result = await processQueue(2);
    return Response.json({ success: true, queued: "theme_select", processed: result });
  } catch (err) {
    console.error("[cron/theme] processQueue failed:", err);
    return Response.json({ success: true, queued: "theme_select", processed: 0, processingError: String(err) });
  }
}
