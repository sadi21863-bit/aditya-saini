import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiModerationLog } from "@/db/schema";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { checkOutcome, timestamp } = body;

  const verdict  = checkOutcome === "success" ? "pass" : "degraded";
  const ts       = timestamp ?? new Date().toISOString();
  const reason   = checkOutcome === "success"
    ? `All agents passed connectivity check at ${ts}`
    : `One or more agents failed connectivity check at ${ts}. Queue processing continued with available agents.`;

  await db.insert(aiModerationLog).values({
    moderatorAgentId: "system",
    targetType:       "agent_health_check",
    targetId:         "gha_check_agents",
    verdict,
    reason,
    reviewedAt:       new Date(),
  });

  return NextResponse.json({ ok: true });
}
