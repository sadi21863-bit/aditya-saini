import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { reports, ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isValidReportType } from "@/lib/justice-engine";

const ReportSchema = z.object({
  targetId: z.string().uuid(),
  domain: z.enum(["private", "public"]),
  reportType: z.string().min(1),
  details: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetId, domain, reportType, details } = parsed.data;

  // Domain guard: plagiarism reports on public ideas are rejected
  if (!isValidReportType(reportType, domain)) {
    return NextResponse.json(
      { error: "Plagiarism reports are not valid for public ideas" },
      { status: 400 }
    );
  }

  // Verify target idea exists
  const [idea] = await db.select({ id: ideas.id, userId: ideas.userId }).from(ideas).where(eq(ideas.id, targetId));
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  if (idea.userId === userId) return NextResponse.json({ error: "Cannot report your own idea" }, { status: 400 });

  await db.insert(reports).values({
    reporterId: userId,
    domain,
    targetId,
    reportType,
    details: details ?? null,
    status: "pending",
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
