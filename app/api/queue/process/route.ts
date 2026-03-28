import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { db } from "@/db";
import { ideas, aiQueue, notifications } from "@/db/schema";
import { eq, and, asc, count } from "drizzle-orm";
import { analyzeIdea, type AIAnalysisResult } from "@/lib/ai";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/queue/process
//
// Queue worker — called by Vercel cron every 1 minute.
// Idempotent: safe to call multiple times concurrently.
//
// Logic:
//   1. Fetch next 5 aiQueue entries where status = "waiting", ordered by position
//   2. For each entry:
//      → Call Groq
//      → SUCCESS: save aiSummary, set done, notify owner
//      → 429:     stop loop immediately (still rate-limited)
//      → FAILED:  set aiStatus = "failed", continue to next entry
//   3. Return { processed, remaining }
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 5;

export async function POST(_req: NextRequest) {
  let processed = 0;
  let stoppedEarly = false;

  // Fetch next batch of waiting entries
  const waitingEntries = await db
    .select()
    .from(aiQueue)
    .where(eq(aiQueue.status, "waiting"))
    .orderBy(asc(aiQueue.position))
    .limit(BATCH_SIZE);

  for (const entry of waitingEntries) {
    // Mark queue entry as processing (idempotency guard)
    await db
      .update(aiQueue)
      .set({ status: "processing" })
      .where(eq(aiQueue.id, entry.ideaId));

    // Fetch the idea
    const ideaRows = await db
      .select()
      .from(ideas)
      .where(eq(ideas.id, entry.ideaId))
      .limit(1);

    if (ideaRows.length === 0) {
      // Idea was deleted — remove queue entry and continue
      await db.delete(aiQueue).where(eq(aiQueue.id, entry.id));
      continue;
    }

    const idea = ideaRows[0];

    // If already done by a concurrent worker, skip
    if (idea.aiStatus === "done" && idea.aiSummary !== null) {
      await db
        .update(aiQueue)
        .set({ status: "done" })
        .where(eq(aiQueue.id, entry.id));
      processed++;
      continue;
    }

    // Mark idea as processing
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

      // ── SUCCESS ──────────────────────────────────────────────────────────────
      await db
        .update(ideas)
        .set({
          aiSummary: JSON.stringify(result),
          aiStatus: "done",
          updatedAt: new Date(),
        })
        .where(eq(ideas.id, entry.ideaId));

      await db
        .update(aiQueue)
        .set({ status: "done" })
        .where(eq(aiQueue.id, entry.id));

      // Notify the idea owner
      if (idea.userId) {
        await db.insert(notifications).values({
          userId: idea.userId,
          type: "ai_ready",
          body: `Your AI analysis for "${idea.title}" is ready!`,
          link: `/idea/${entry.ideaId}`,
          domain: "vault",
        });
      }

      processed++;

    } catch (err: unknown) {
      const isGroqError = err instanceof Groq.APIError;

      if (isGroqError && err.status === 429) {
        // ── RATE LIMITED — stop immediately, reset this entry to waiting ────────
        await db
          .update(aiQueue)
          .set({ status: "waiting" })
          .where(eq(aiQueue.id, entry.id));

        await db
          .update(ideas)
          .set({ aiStatus: "queued", updatedAt: new Date() })
          .where(eq(ideas.id, entry.ideaId));

        stoppedEarly = true;
        break; // Exit loop — don't attempt any more entries
      }

      // ── OTHER ERROR — mark failed, continue to next entry ────────────────────
      console.error(
        `[queue/process] Failed to analyse idea ${entry.ideaId}:`,
        err instanceof Error ? err.message : err
      );

      await db
        .update(ideas)
        .set({ aiStatus: "failed", updatedAt: new Date() })
        .where(eq(ideas.id, entry.ideaId));

      await db
        .update(aiQueue)
        .set({ status: "done" }) // treat as done to remove from queue
        .where(eq(aiQueue.id, entry.id));
    }
  }

  // Count remaining waiting entries
  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(aiQueue)
    .where(eq(aiQueue.status, "waiting"));

  return NextResponse.json({
    processed,
    remaining: Number(remaining),
    stoppedEarly,
  });
}
