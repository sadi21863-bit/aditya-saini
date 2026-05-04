import { checkCronAuth } from "@/lib/agents/cron-auth";
import { processQueue } from "@/lib/agents/executor";

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const result = await processQueue(5);
    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron/tick]", err);
    return Response.json({ error: "Queue processing failed" }, { status: 500 });
  }
}
