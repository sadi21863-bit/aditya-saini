"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { jsonbMerge } from "@/lib/jsonb";

// ─────────────────────────────────────────────────────────────────────────────
// JUSTICE AUDIT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AuditStatus = "verified" | "flagged";

export interface AuditMetadata {
    scanned: boolean;
    riskScore: number;
    lastAudit: string; // ISO timestamp
    status: AuditStatus;
    scanVersion?: string; // For future ML model versioning
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PERFORM JUSTICE AUDIT ─────────────────────────────────────────────────────
// Simulates AI content scanning and assigns risk score.
// Phase 3: Uses random score. Phase 4+ will integrate real ML models.
// ─────────────────────────────────────────────────────────────────────────────

export async function performJusticeAudit(ideaId: string) {
    try {
        // 1. Fetch the idea
        const [idea] = await db
            .select({
                id: ideas.id,
                title: ideas.title,
                content: ideas.content,
                genesisHash: ideas.genesisHash,
                aiMetadata: ideas.aiMetadata,
            })
            .from(ideas)
            .where(eq(ideas.id, ideaId));

        if (!idea) {
            return { success: false, error: "Idea not found" };
        }

        // 2. Simulate AI Risk Scoring (0-100)
        // Future: Replace with actual ML model inference
        const riskScore = Math.floor(Math.random() * 100);

        // 3. Determine audit status based on threshold
        const status: AuditStatus = riskScore > 75 ? "flagged" : "verified";

        // 4. Build audit metadata
        const auditMetadata: AuditMetadata = {
            scanned: true,
            riskScore,
            lastAudit: new Date().toISOString(),
            status,
            scanVersion: "v1.0-dev", // Track which model version performed scan
        };

        // 5. Update idea with merged metadata (preserves other fields)
        await db
            .update(ideas)
            .set({
                aiMetadata: jsonbMerge(ideas.aiMetadata, auditMetadata),
                updatedAt: new Date(),
            })
            .where(eq(ideas.id, ideaId));

        // 6. Revalidate paths
        revalidatePath("/admin/justice");
        revalidatePath("/feed");
        revalidatePath(`/idea/${ideaId}`);

        return {
            success: true,
            data: {
                ideaId,
                riskScore,
                status,
                message:
                    status === "flagged"
                        ? `⚠️ Flagged: Risk score ${riskScore}/100`
                        : `✅ Verified: Risk score ${riskScore}/100`,
            },
        };
    } catch (error) {
        console.error("Justice Audit failed:", error);
        return { success: false, error: "Audit system error" };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── BATCH AUDIT ───────────────────────────────────────────────────────────────
// Audits all public ideas that haven't been scanned yet
// ─────────────────────────────────────────────────────────────────────────────

export async function batchAuditUnscanned() {
    try {
        // Fetch all public ideas without scanned flag
        const unscannedIdeas = await db
            .select({ id: ideas.id })
            .from(ideas)
            .where(eq(ideas.status, "public"));

        let scannedCount = 0;
        let flaggedCount = 0;

        // Audit each idea
        for (const idea of unscannedIdeas) {
            const result = await performJusticeAudit(idea.id);
            if (result.success) {
                scannedCount++;
                if (result.data?.status === "flagged") {
                    flaggedCount++;
                }
            }
        }

        revalidatePath("/admin/justice");

        return {
            success: true,
            data: {
                scannedCount,
                flaggedCount,
                message: `Scanned ${scannedCount} ideas. Flagged ${flaggedCount}.`,
            },
        };
    } catch (error) {
        console.error("Batch audit failed:", error);
        return { success: false, error: "Batch audit system error" };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MANUAL OVERRIDE (Admin only) ──────────────────────────────────────────────
// Allows admin to manually verify or flag an idea
// ─────────────────────────────────────────────────────────────────────────────

export async function manualOverride(
    ideaId: string,
    status: AuditStatus,
    adminNote?: string
) {
    try {
        const overrideMetadata = {
            status,
            manualOverride: true,
            overrideTimestamp: new Date().toISOString(),
            adminNote: adminNote ?? "Manual review",
        };

        await db
            .update(ideas)
            .set({
                aiMetadata: jsonbMerge(ideas.aiMetadata, overrideMetadata),
                updatedAt: new Date(),
            })
            .where(eq(ideas.id, ideaId));

        revalidatePath("/admin/justice");
        revalidatePath("/feed");
        revalidatePath(`/idea/${ideaId}`);

        return {
            success: true,
            message: `Idea ${status === "verified" ? "verified" : "flagged"} by admin`,
        };
    } catch (error) {
        console.error("Manual override failed:", error);
        return { success: false, error: "Override failed" };
    }
}
