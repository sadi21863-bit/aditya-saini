"use server";

import { db } from "@/db";
import { ideas, reports } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { jsonbMerge } from "@/lib/jsonb";
import { requireAdmin } from "@/lib/auth";
import { createNotification } from "./notificationActions";
import { awardXp } from "@/lib/xp";
import { XP_EVENTS } from "@/lib/tier-engine";
import { runJusticeAudit, runHashScan } from "@/lib/justice-engine";
import type { AuditStatus, AdminAction } from "@/lib/justice-types";

export async function performJusticeAudit(ideaId: string) {
  try {
    await requireAdmin();
    const [idea] = await db.select({ id: ideas.id, title: ideas.title, content: ideas.content, genesisHash: ideas.genesisHash, aiMetadata: ideas.aiMetadata, userId: ideas.userId, domain: ideas.domain }).from(ideas).where(eq(ideas.id, ideaId));
    if (!idea) return { success: false, error: "Idea not found" };

    const { riskScore, status, metadata } = runJusticeAudit(idea);
    let hashDuplicate = false;
    if (idea.domain === "private" && idea.genesisHash) {
      hashDuplicate = await runHashScan(ideaId, idea.genesisHash, db);
    }

    await db.update(ideas).set({ aiMetadata: jsonbMerge(ideas.aiMetadata, { ...metadata, hashDuplicate }), updatedAt: new Date() }).where(eq(ideas.id, ideaId));

    if (status === "flagged" && idea.userId && !metadata.isMockScore) {
      await createNotification({ userId: idea.userId, type: "milestone", body: `⚠️ Your idea "${idea.title}" was flagged (risk: ${riskScore}/100).`, link: `/idea/${ideaId}` });
    }

    revalidatePath("/admin/justice");
    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);
    return { success: true, data: { ideaId, riskScore, status, hashDuplicate, isMockScore: metadata.isMockScore, message: status === "flagged" ? `⚠️ Flagged: ${riskScore}/100` : `✅ Verified: ${riskScore}/100` } };
  } catch (error) {
    console.error("Justice Audit failed:", error);
    return { success: false, error: "Audit system error" };
  }
}

export async function batchAuditUnscanned() {
  try {
    await requireAdmin();
    const unscanned = await db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.status, "published"), sql`(${ideas.aiMetadata}->>'scanned')::boolean IS NOT TRUE`));
    let scannedCount = 0, flaggedCount = 0;
    for (const idea of unscanned) {
      const result = await performJusticeAudit(idea.id);
      if (result.success) { scannedCount++; if (result.data?.status === "flagged") flaggedCount++; }
    }
    revalidatePath("/admin/justice");
    return { success: true, data: { scannedCount, flaggedCount, message: `Scanned ${scannedCount} ideas. Flagged ${flaggedCount}.` } };
  } catch (error) {
    console.error("Batch audit failed:", error);
    return { success: false, error: "Batch audit system error" };
  }
}

export async function manualOverride(ideaId: string, status: AuditStatus, adminNote?: string) {
  try {
    await requireAdmin();
    await db.update(ideas).set({ aiMetadata: jsonbMerge(ideas.aiMetadata, { status, manualOverride: true, overrideTimestamp: new Date().toISOString(), adminNote: adminNote ?? "Manual review", isMockScore: false }), updatedAt: new Date() }).where(eq(ideas.id, ideaId));
    revalidatePath("/admin/justice");
    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);
    return { success: true, message: `Idea ${status === "verified" ? "verified ✅" : "flagged ⚠️"} by admin` };
  } catch (error) {
    console.error("Manual override failed:", error);
    return { success: false, error: "Override failed" };
  }
}

export async function toggleEditorsPick(ideaId: string, value: boolean) {
  await requireAdmin();
  await db.update(ideas).set({ editorsPick: value, updatedAt: new Date() }).where(eq(ideas.id, ideaId));
  revalidatePath("/feed");
  revalidatePath("/leaderboard");
  revalidatePath(`/idea/${ideaId}`);
  return { success: true };
}

export async function resolveReport(reportId: string, action: AdminAction, adminNote?: string) {
  try {
    await requireAdmin();
    const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
    if (!report) return { success: false, error: "Report not found" };

    const [idea] = await db.select({ id: ideas.id, userId: ideas.userId, title: ideas.title }).from(ideas).where(eq(ideas.id, report.targetId));

    if (action === "dismiss") {
      await db.update(reports).set({ status: "dismissed", adminNote: adminNote ?? "Dismissed" }).where(eq(reports.id, reportId));
      if (report.reporterId) await createNotification({ userId: report.reporterId, type: "report_resolved", body: "Your report was reviewed and dismissed." });

    } else if (action === "warn_user") {
      await db.update(reports).set({ status: "reviewed", adminNote: adminNote ?? "User warned" }).where(eq(reports.id, reportId));
      if (idea?.userId) await createNotification({ userId: idea.userId, type: "warning", body: `⚠️ Your idea "${idea.title}" received a moderation warning.`, link: `/idea/${idea.id}` });

    } else if (action === "remove_idea") {
      await db.update(reports).set({ status: "reviewed", adminNote: adminNote ?? "Idea removed" }).where(eq(reports.id, reportId));
      if (idea) {
        await db.update(ideas).set({ status: "draft", title: "[removed by moderator]", content: null, context: null, updatedAt: new Date() }).where(eq(ideas.id, idea.id));
        if (idea.userId) await createNotification({ userId: idea.userId, type: "removal", body: "Your idea was removed following a moderation review." });
      }
      if (report.reporterId) await awardXp(report.reporterId, XP_EVENTS.VALID_REPORT_RESOLVED);

    } else if (action === "ban_user") {
      // P0.2 FIX v14: previously this just updated the DB report row and did nothing to the Clerk account.
      // Now it actually calls clerk.users.banUser() to enforce the ban.
      await db.update(reports).set({ status: "reviewed", adminNote: adminNote ?? "User banned" }).where(eq(reports.id, reportId));
      if (idea?.userId) {
        await createNotification({ userId: idea.userId, type: "ban", body: "Your account has been suspended." });
        try {
          const { clerkClient } = await import("@clerk/nextjs/server");
          const clerk = await clerkClient();
          await clerk.users.banUser(idea.userId);
        } catch (banError) {
          console.error("Clerk banUser failed:", banError);
          return { success: false, error: "Report updated but Clerk ban failed — check server logs" };
        }
      }
    }

    revalidatePath("/admin/justice");
    return { success: true };
  } catch (error) {
    console.error("resolveReport failed:", error);
    return { success: false, error: "Failed to resolve report" };
  }
}
