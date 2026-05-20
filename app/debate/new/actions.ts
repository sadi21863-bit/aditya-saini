"use server";

import { auth }           from "@/lib/auth";
import { db }             from "@/db";
import { quickDebates, rooms, roomMembers, ideas, aiQueue } from "@/db/schema";
import { processQueue }   from "@/lib/agents/executor";
import { redirect }       from "next/navigation";
import { z }              from "zod";
import { sql }            from "drizzle-orm";

// Hard cap: max Quick Debates per calendar day (UTC) across all users.
// Prevents coordinated traffic from burning the GitHub Models 150 RPD budget
// before the daily AI Lab archive runs.
const DAILY_CAP = 5;

const schema = z.object({
  ideaText: z
    .string()
    .min(20, "Must be at least 20 characters")
    .max(500, "Keep it under 500 characters"),
});

export async function submitQuickDebate(
  _prevState: unknown,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to submit a debate." };

  const parsed = schema.safeParse({ ideaText: formData.get("ideaText") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { ideaText } = parsed.data;
  const userId = session.user.id;

  // ── Daily cap check (counts all debates created today in UTC) ──────
  const [countRow] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(quickDebates)
    .where(sql`DATE(${quickDebates.createdAt} AT TIME ZONE 'UTC') = CURRENT_DATE`);

  if (Number(countRow?.n ?? 0) >= DAILY_CAP) {
    return {
      error: `The debate queue is full for today (${DAILY_CAP} debates/day limit). Check back tomorrow.`,
    };
  }

  // ── 1. Auto-create a private ephemeral backing room ─────────────────
  const [room] = await db
    .insert(rooms)
    .values({
      name:        ideaText.slice(0, 80),
      description: "Auto-created for Quick Debate",
      creatorId:   userId,
      isAiLab:     true,
      isEphemeral: true,
      visibility:  "private",
      status:      "active",
    })
    .returning();

  // ── 2. Add user as owner of backing room ────────────────────────────
  await db.insert(roomMembers).values({
    roomId: room.id,
    userId,
    role:   "owner",
  });

  // ── 3. Create the idea in the backing room ──────────────────────────
  const [idea] = await db
    .insert(ideas)
    .values({
      roomId:               room.id,
      userId,
      title:                ideaText.slice(0, 80),
      content:              ideaText,
      labDiscussionAllowed: true,
      feedVisible:          false,
      status:               "active",
    })
    .returning();

  // ── 4. Create the quickDebates record ──────────────────────────────
  const [debate] = await db
    .insert(quickDebates)
    .values({
      ideaText,
      submittedBy: userId,
      roomId:      room.id,
      status:      "queued",
    })
    .returning();

  // ── 5. Queue the seed job for Llama (priority 1 — highest) ─────────
  await db.insert(aiQueue).values({
    agentId:      "ai_llama",
    actionType:   "quick_debate_seed",
    roomId:       room.id,
    targetIdeaId: idea.id,
    promptContext: { debateId: debate.id, ideaId: idea.id },
    scheduledFor: new Date(),
    priority:     1,
    status:       "pending",
  });

  // ── 6. Fire processQueue non-blocking ───────────────────────────────
  // Do NOT await — Vercel hobby functions have a 10s timeout.
  // The queue tick cron picks up anything that doesn't complete here.
  processQueue().catch((err) =>
    console.error("[quick-debate] processQueue fire failed:", (err as Error).message)
  );

  redirect(`/debate/${debate.id}`);
}
