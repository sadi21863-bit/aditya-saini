import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueAILabDebateOfDay } from "@/lib/agents/scheduler";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const url   = new URL(req.url);
  const date  = url.searchParams.get("date") ?? undefined;

  try {
    await queueAILabDebateOfDay(date);
  } catch (err) {
    console.error("[cron/lab-debate] queueAILabDebateOfDay failed:", err);
    return Response.json({ error: "Failed to queue ai_lab_debate" }, { status: 500 });
  }

  try {
    const result = await processQueue(2);
    return Response.json({ success: true, queued: "ai_lab_debate", date: date ?? "today", processed: result });
  } catch (err) {
    console.error("[cron/lab-debate] processQueue failed:", err);
    return Response.json({ success: true, queued: "ai_lab_debate", date: date ?? "today", processed: 0, processingError: String(err) });
  }
}
