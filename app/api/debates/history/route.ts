import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/db";
import { debates }                   from "@/db/schema";
import { eq, desc }                  from "drizzle-orm";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rows = await db.select().from(debates)
    .where(eq(debates.userId, session.user.id))
    .orderBy(desc(debates.createdAt))
    .limit(50);

  return NextResponse.json({ debates: rows });
}
