/**
 * app/api/og/route.tsx
 *
 * Open Graph image generation endpoint.
 *
 * STUB: @vercel/og is not installed. This returns a JSON placeholder so the
 * build compiles. To enable real OG images:
 *
 *   npm install @vercel/og
 *
 * Then replace this file with the full implementation from the v14 research report.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "IdeaConnect";

  // Placeholder — returns a JSON description until @vercel/og is installed.
  return NextResponse.json({
    status: "og_stub",
    message: "Install @vercel/og to enable dynamic Open Graph images.",
    title,
  });
}
