import { NextRequest, NextResponse } from "next/server";

// Note: The current schema does not have a 'views' column on ideas.
// This endpoint is a safe stub until a view counter column is added.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ counted: false, note: "View tracking not yet active" });
}
