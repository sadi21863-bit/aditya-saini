import { NextRequest, NextResponse } from "next/server";
import { recordView } from "@/app/actions/ideaActions";

/**
 * POST /api/view/[id]
 *
 * Cookie-based view deduplication.
 * Called by a lightweight client-side effect on the idea detail page.
 *
 * Flow:
 *   1. Check for `viewed_<id>` cookie in the incoming request
 *   2. If absent → call recordView() to increment DB counter, set cookie
 *   3. If present → skip increment, return early
 *
 * Cookie TTL: 24 hours (prevents self-inflation on repeated visits)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Next.js 16: await params before reading
  const resolvedParams = await params;
  const ideaId = resolvedParams.id;

  if (!ideaId) {
    return NextResponse.json({ error: "Missing idea ID" }, { status: 400 });
  }

  const cookieKey = `viewed_${ideaId}`;
  const alreadyCounted = request.cookies.has(cookieKey);

  if (alreadyCounted) {
    return NextResponse.json({ counted: false, reason: "already_viewed" });
  }

  try {
    await recordView(ideaId);

    // Build the response and attach a 24-hour cookie
    const response = NextResponse.json({ counted: true });
    response.cookies.set(cookieKey, "1", {
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
      maxAge:   60 * 60 * 24, // 24 hours in seconds
    });

    return response;
  } catch (err) {
    console.error("View recording failed:", err);
    // Fail silently — a missing view count is not a critical error
    return NextResponse.json({ counted: false, reason: "error" });
  }
}
