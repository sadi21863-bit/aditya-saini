"use server";

import { db } from "@/db";
import { aiLabArchives, aiLabRollups, aiModerationLog, aiQueue } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth";
import { ALL_AGENTS } from "@/lib/agents/personas";

type ActionResult = { success: boolean; error?: string; message?: string };

// ─── Auth helper ──────────────────────────────────────────────────────

/** Asserts admin role and returns the admin's user ID for audit logging. */
async function getAdminUserId(): Promise<string> {
  await requireAdmin();
  return (await getAuthenticatedUserId()) ?? "system";
}

// ─── Moderation log helper ────────────────────────────────────────────

async function logAction(
  adminId:    string,
  targetType: string,
  targetId:   string,
  verdict:    string,
  reason:     string
): Promise<void> {
  await db.insert(aiModerationLog).values({
    moderatorAgentId: adminId,
    targetType,
    targetId,
    verdict,
    reason,
    reviewedAt: new Date(),
  });
}

// ─── approveArchive ───────────────────────────────────────────────────

/**
 * Publishes a draft or flagged archive.
 * Throws if caller is not an admin.
 */
export async function approveArchive(archiveId: string, isRollup = false): Promise<ActionResult> {
  const adminId = await getAdminUserId();

  try {
    const now = new Date();
    const targetType = isRollup ? "rollup" : "archive";

    if (isRollup) {
      await db
        .update(aiLabRollups)
        .set({ status: "published", publishedAt: now, reviewedByAgentId: adminId, reviewedAt: now })
        .where(eq(aiLabRollups.id, archiveId));
    } else {
      await db
        .update(aiLabArchives)
        .set({ status: "published", publishedAt: now, reviewedByAgentId: adminId, reviewedAt: now })
        .where(eq(aiLabArchives.id, archiveId));
    }

    await logAction(adminId, targetType, archiveId, "approved", "Admin manually approved archive");

    revalidatePath("/admin/ai-lab/archives");
    revalidatePath("/ai-lab/archive");

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─── editArchiveNarrative ─────────────────────────────────────────────

/**
 * Replaces the narrative_arc of an archive without changing its status.
 * Allows editing drafts, flagged, or published archives.
 * Throws if caller is not an admin.
 */
export async function editArchiveNarrative(
  archiveId:    string,
  newNarrative: string,
  isRollup = false
): Promise<ActionResult> {
  const adminId = await getAdminUserId();

  if (!newNarrative.trim()) {
    return { success: false, error: "Narrative cannot be empty" };
  }
  if (newNarrative.length > 5000) {
    return { success: false, error: "Narrative must be under 5000 characters" };
  }

  try {
    const targetType = isRollup ? "rollup" : "archive";

    if (isRollup) {
      await db
        .update(aiLabRollups)
        .set({ narrativeArc: newNarrative, summaryMarkdown: newNarrative })
        .where(eq(aiLabRollups.id, archiveId));
    } else {
      await db
        .update(aiLabArchives)
        .set({ narrativeArc: newNarrative, summaryMarkdown: newNarrative })
        .where(eq(aiLabArchives.id, archiveId));
    }

    await logAction(adminId, targetType, archiveId, "edited", "Admin edited narrative_arc");

    revalidatePath("/admin/ai-lab/archives");
    revalidatePath("/ai-lab/archive");

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─── regenerateArchive ────────────────────────────────────────────────

/**
 * Deletes the archive row and queues a fresh archive_day action for the same date.
 * The delete and queue insert happen in a single transaction — if the queue
 * write fails, the archive is NOT deleted.
 *
 * Only supported for daily archives. Rollup re-generation must be triggered
 * via the scheduler cron routes (different action types, different date logic).
 *
 * Throws if caller is not an admin.
 */
export async function regenerateArchive(archiveId: string): Promise<ActionResult> {
  const adminId = await getAdminUserId();

  try {
    // Load archive to get the date before deleting
    const rows = await db
      .select({ date: aiLabArchives.date })
      .from(aiLabArchives)
      .where(eq(aiLabArchives.id, archiveId));

    const archive = rows[0];
    if (!archive) return { success: false, error: "Archive not found" };

    const date      = String(archive.date);
    const archivist = ALL_AGENTS.find((a) => a.role === "archivist");
    if (!archivist) return { success: false, error: "Archivist agent not found" };

    // Single transaction: log + delete + re-queue.
    // If the queue insert fails, the delete is rolled back.
    await db.transaction(async (tx) => {
      await tx.insert(aiModerationLog).values({
        moderatorAgentId: adminId,
        targetType:       "archive",
        targetId:          archiveId,
        verdict:           "regenerated",
        reason:            "Admin deleted archive and queued regeneration",
        reviewedAt:        new Date(),
      });

      await tx.delete(aiLabArchives).where(eq(aiLabArchives.id, archiveId));

      await tx.insert(aiQueue).values({
        agentId:      archivist.id,
        actionType:   "archive_day",
        roomId:       process.env.AI_LAB_ROOM_ID ?? "",
        promptContext: { date },
        scheduledFor:  new Date(),
        priority:      1,
        status:        "pending",
      });
    });

    revalidatePath("/admin/ai-lab/archives");

    return { success: true, message: "Regeneration queued" };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─── rejectArchive ────────────────────────────────────────────────────

/**
 * Permanently rejects an archive. Rejected archives are excluded from all
 * public pages by the existing `status !== 'published'` filter.
 * Throws if caller is not an admin.
 */
export async function rejectArchive(
  archiveId: string,
  reason:    string,
  isRollup = false
): Promise<ActionResult> {
  const adminId = await getAdminUserId();

  if (!reason.trim()) {
    return { success: false, error: "Rejection reason cannot be empty" };
  }

  try {
    const targetType = isRollup ? "rollup" : "archive";

    if (isRollup) {
      await db
        .update(aiLabRollups)
        .set({ status: "rejected", flaggedReason: reason, reviewedByAgentId: adminId, reviewedAt: new Date() })
        .where(eq(aiLabRollups.id, archiveId));
    } else {
      await db
        .update(aiLabArchives)
        .set({ status: "rejected", flaggedReason: reason, reviewedByAgentId: adminId, reviewedAt: new Date() })
        .where(eq(aiLabArchives.id, archiveId));
    }

    await logAction(adminId, targetType, archiveId, "rejected", reason);

    revalidatePath("/admin/ai-lab/archives");
    revalidatePath("/ai-lab/archive");

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
