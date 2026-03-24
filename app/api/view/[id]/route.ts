import { NextRequest, NextResponse } from "next/server";
import { recordView } from "@/app/actions/ideaActions";

/**
 * POST /api/view/[id]
 *
 * FIX #4: Cookie is now only set when recordView() actually recorded the view.
 * Previously the cookie was set even when recordView() returned void (unauthenticated
 * user), permanently blocking future authenticated view counts on that browser.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    // FIX #4: recordView now returns boolean — only set cookie on true
    const recorded = await recordView(ideaId);

    if (!recorded) {
      // Guest or rate-limited — don't set cookie so authenticated views can
      // still be counted on a future visit
      return NextResponse.json({ counted: false, reason: "not_recorded" });
    }

    const response = NextResponse.json({ counted: true });
    response.cookies.set(cookieKey, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err) {
    console.error("View recording failed:", err);
    return NextResponse.json({ counted: false, reason: "error" });
  }
}
