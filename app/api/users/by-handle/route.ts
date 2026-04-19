import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const handle = req.nextUrl.searchParams.get("handle")?.toLowerCase().trim();
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 });

  const [user] = await db
    .select({ userId: users.id, handle: users.handle, name: users.name })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ userId: user.userId, handle: user.handle, name: user.name });
}
