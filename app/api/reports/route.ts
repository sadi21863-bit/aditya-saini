import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { z } from "zod";

const ReportSchema = z.object({
  targetType: z.enum(["idea", "room", "comment", "user"]),
  targetId:   z.string().min(1),
  reportType: z.enum(["spam", "harassment", "off-topic", "other"]),
  details:    z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetType, targetId, reportType, details } = parsed.data;

  await db.insert(reports).values({
    reporterId: userId,
    targetType,
    targetId,
    reportType,
    details: details ?? null,
    status: "pending",
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
