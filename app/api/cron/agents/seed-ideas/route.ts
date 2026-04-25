import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueDailyIdeas } from "@/lib/agents/scheduler";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueDailyIdeas();
    return Response.json({ success: true, queued: "post_idea", count: 3 });
  } catch (err) {
    console.error("[cron/seed-ideas]", err);
    return Response.json({ error: "Failed to queue daily ideas" }, { status: 500 });
  }
}
