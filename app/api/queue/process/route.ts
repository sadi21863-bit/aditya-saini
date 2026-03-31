import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { db } from "@/db";
import { ideas, aiQueue, notifications } from "@/db/schema";
import { eq, asc, count } from "drizzle-orm";
import { analyzeIdea, type AIAnalysisResult } from "@/lib/ai";

const BATCH_SIZE = 5;

export async function POST(req: NextRequest) {
  // FIX v12: CRON_SECRET auth — endpoint was fully public
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let processed = 0;
  let stoppedEarly = false;

  const waitingEntries = await db
    .select()
    .from(aiQueue)
    .where(eq(aiQueue.status, "waiting"))
    .orderBy(asc(aiQueue.position))
    .limit(BATCH_SIZE);

  for (const entry of waitingEntries) {
    // FIX v12: was entry.ideaId — should be entry.id to mark the queue row
    await db
      .update(aiQueue)
      .set({ status: "processing" })
      .where(eq(aiQueue.id, entry.id));

    const ideaRows = await db.select().from(ideas).where(eq(ideas.id, entry.ideaId)).limit(1);

    if (ideaRows.length === 0) {
      await db.delete(aiQueue).where(eq(aiQueue.id, entry.id));
      continue;
    }

    const idea = ideaRows[0];

    if (idea.aiStatus === "done" && idea.aiSummary !== null) {
      await db.update(aiQueue).set({ status: "done" }).where(eq(aiQueue.id, entry.id));
      processed++;
      continue;
    }

    await db
      .update(ideas)
      .set({ aiStatus: "processing", updatedAt: new Date() })
      .where(eq(ideas.id, entry.ideaId));

    try {
      const result: AIAnalysisResult = await analyzeIdea({
        title: idea.title,
        description: idea.content ?? idea.context ?? "",
        classification: idea.category ?? undefined,
        tags: idea.tags,
      });

      await db
        .update(ideas)
        .set({ aiSummary: JSON.stringify(result), aiStatus: "done", updatedAt: new Date() })
        .where(eq(ideas.id, entry.ideaId));

      await db.update(aiQueue).set({ status: "done" }).where(eq(aiQueue.id, entry.id));

      if (idea.userId) {
        await db.insert(notifications).values({
          userId: idea.userId,
          type: "ai_ready",
          body: `Your AI analysis for "${idea.title}" is ready!`,
          link: `/idea/${entry.ideaId}`,
          domain: "private",
        });
      }

      processed++;
    } catch (err: unknown) {
      const isGroqError = err instanceof Groq.APIError;
      if (isGroqError && err.status === 429) {
        await db.update(aiQueue).set({ status: "waiting" }).where(eq(aiQueue.id, entry.id));
        await db.update(ideas).set({ aiStatus: "queued", updatedAt: new Date() }).where(eq(ideas.id, entry.ideaId));
        stoppedEarly = true;
        break;
      }
      console.error(`[queue/process] Failed idea ${entry.ideaId}:`, err instanceof Error ? err.message : err);
      await db.update(ideas).set({ aiStatus: "failed", updatedAt: new Date() }).where(eq(ideas.id, entry.ideaId));
      await db.update(aiQueue).set({ status: "done" }).where(eq(aiQueue.id, entry.id));
    }
  }

  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(aiQueue)
    .where(eq(aiQueue.status, "waiting"));

  return NextResponse.json({ processed, remaining: Number(remaining), stoppedEarly });
}
