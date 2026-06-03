import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { debates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const BodySchema = z.object({
  email:      z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address."),
  shareToken: z.string().min(1),  // proof of access — caller must have the share link
});

// Simple in-memory rate limit: max 3 email saves per IP per 10 minutes
const emailSaveAttempts = new Map<string, { count: number; resetAt: number }>();

type Params = { id: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;

  // Per-IP rate limit
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now      = Date.now();
  const entry    = emailSaveAttempts.get(clientIp);
  if (entry && entry.resetAt > now) {
    if (entry.count >= 3) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    entry.count++;
  } else {
    emailSaveAttempts.set(clientIp, { count: 1, resetAt: now + 10 * 60 * 1000 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { email, shareToken } = parsed.data;

  // Verify debate exists, is complete, AND the caller provided the correct shareToken.
  // shareToken is the access credential for anonymous users — it's only exposed on the
  // share page URL, so possessing it proves the user saw the debate.
  const [debate] = await db
    .select({ id: debates.id, shareToken: debates.shareToken })
    .from(debates)
    .where(and(eq(debates.id, id), eq(debates.status, "archived")))
    .limit(1);

  if (!debate || debate.shareToken !== shareToken) {
    return NextResponse.json({ error: "Debate not found or not yet complete." }, { status: 404 });
  }

  await db.update(debates).set({ userEmail: email }).where(eq(debates.id, id));

  // TODO: wire email provider
  // If an email service is configured, send the share link here.
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = debate.shareToken ? `${appUrl}/debates/share/${debate.shareToken}` : null;
  console.log(`[EMAIL STUB] Would send to: ${email} — configure email provider. Share URL: ${shareUrl}`);

  return NextResponse.json({ success: true });
}
