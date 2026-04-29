import { checkCronAuth } from "@/lib/agents/cron-auth";
import { processQueue } from "@/lib/agents/executor";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const result = await processQueue(20);
    return Response.json({ success: true, processed: result });
  } catch (err) {
    console.error("[cron/catchup] processQueue failed:", err);
    return Response.json({ error: "Catch-up processing failed", detail: String(err) }, { status: 500 });
  }
}
