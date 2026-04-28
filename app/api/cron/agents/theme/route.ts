import { checkCronAuth } from "@/lib/agents/cron-auth";
import { queueThemeSelection } from "@/lib/agents/scheduler";

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    await queueThemeSelection();
    return Response.json({ success: true, queued: "theme_select" });
  } catch (err) {
    console.error("[cron/theme]", err);
    return Response.json({ error: "Failed to queue theme selection" }, { status: 500 });
  }
}
