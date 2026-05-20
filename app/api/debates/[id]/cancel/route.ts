import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/db";
import { debates, aiQueue }          from "@/db/schema";
import { eq, and, sql }              from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id: debateId } = await params;

  const [debate] = await db.select().from(debates)
    .where(and(eq(debates.id, debateId), eq(debates.userId, session.user.id)))
    .limit(1);
  if (!debate) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.update(debates)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(eq(debates.id, debateId));

  await db.update(aiQueue)
    .set({ status: "cancelled" })
    .where(and(
      sql`${aiQueue.promptContext}->>'debateId' = ${debateId}`,
      eq(aiQueue.status, "pending"),
    ));

  return NextResponse.json({ status: "abandoned" });
}
