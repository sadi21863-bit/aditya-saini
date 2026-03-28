"use server";

import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { jsonbMerge } from "@/lib/jsonb";
import { requireAdmin, getAuthenticatedUserId } from "@/lib/auth";
import { createNotification } from "./notificationActions";
import { awardXp } from "@/lib/xp";
import { createHash } from "crypto";
import type { AuditStatus, AuditMetadata } from "@/lib/justice-types";

// ─── JUSTICE AUDIT ────────────────────────────────────────────────────────────

export async function performJusticeAudit(ideaId: string) {
  try {
    await requireAdmin();
    const [idea] = await db
      .select({
        id: ideas.id,
        title: ideas.title,
        content: ideas.content,
        genesisHash: ideas.genesisHash,
        aiMetadata: ideas.aiMetadata,
        userId: ideas.userId,
      })
      .from(ideas)
      .where(eq(ideas.id, ideaId));

    if (!idea) return { success: false, error: "Idea not found" };

    // Deterministic SHA-256-based risk score — same idea always gets the same score
    const hash = createHash("sha256")
      .update((idea.content ?? "") + (idea.title ?? ""))
      .digest("hex");
    const riskScore = parseInt(hash.slice(0, 4), 16) % 100;
    const isMockScore = true;
    const status: AuditStatus = riskScore > 75 ? "flagged" : "verified";

    const auditMetadata: AuditMetadata = {
      scanned: true,
      riskScore,
      lastAudit: new Date().toISOString(),
      status,
      scanVersion: "v2.0-justice-mock",
      isMockScore,
    };

    await db
      .update(ideas)
      .set({
        aiMetadata: jsonbMerge(ideas.aiMetadata, auditMetadata),
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, ideaId));

    if (status === "flagged" && idea.userId && !isMockScore) {
      await createNotification({
        userId: idea.userId,
        type: "milestone",
        body: `⚠️ Your idea "${idea.title}" has been flagged by the Justice Engine (risk score: ${riskScore}/100).`,
        link: `/idea/${ideaId}`,
      });
    }

    revalidatePath("/admin/justice");
    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);

    return {
      success: true,
      data: {
        ideaId,
        riskScore,
        status,
        isMockScore,
        message:
          status === "flagged"
            ? `⚠️ Flagged (simulated): Risk score ${riskScore}/100`
            : `✅ Verified (simulated): Risk score ${riskScore}/100`,
      },
    };
  } catch (error) {
    console.error("Justice Audit failed:", error);
    return { success: false, error: "Audit system error" };
  }
}

export async function batchAuditUnscanned() {
  try {
    await requireAdmin();
    // v12: status is "published" (not "public")
    const unscanned = await db
      .select({ id: ideas.id })
      .from(ideas)
      .where(
        and(
          eq(ideas.status, "published"),
          sql`(${ideas.aiMetadata}->>'scanned')::boolean IS NOT TRUE`
        )
      );

    let scannedCount = 0;
    let flaggedCount = 0;

    for (const idea of unscanned) {
      const result = await performJusticeAudit(idea.id);
      if (result.success) {
        scannedCount++;
        if (result.data?.status === "flagged") flaggedCount++;
      }
    }

    revalidatePath("/admin/justice");
    return {
      success: true,
      data: {
        scannedCount,
        flaggedCount,
        message: `Scanned ${scannedCount} ideas. Flagged ${flaggedCount} (simulated scores).`,
      },
    };
  } catch (error) {
    console.error("Batch audit failed:", error);
    return { success: false, error: "Batch audit system error" };
  }
}

export async function manualOverride(
  ideaId: string,
  status: AuditStatus,
  adminNote?: string
) {
  try {
    await requireAdmin();

    await db
      .update(ideas)
      .set({
        aiMetadata: jsonbMerge(ideas.aiMetadata, {
          status,
          manualOverride: true,
          overrideTimestamp: new Date().toISOString(),
          adminNote: adminNote ?? "Manual review",
          isMockScore: false,
        }),
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, ideaId));

    revalidatePath("/admin/justice");
    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);

    return {
      success: true,
      message: `Idea ${status === "verified" ? "verified ✅" : "flagged ⚠️"} by admin`,
    };
  } catch (error) {
    console.error("Manual override failed:", error);
    return { success: false, error: "Override failed" };
  }
}

export async function toggleEditorsPick(ideaId: string, value: boolean) {
  await requireAdmin();

  await db
    .update(ideas)
    .set({ editorsPick: value, updatedAt: new Date() })
    .where(eq(ideas.id, ideaId));

  revalidatePath("/feed");
  revalidatePath("/leaderboard");
  revalidatePath(`/idea/${ideaId}`);
  return { success: true };
}
