"use server";

import { db } from "@/db";
import { ideas, communityNotes, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { jsonbMerge } from "@/lib/jsonb";
import { requireAdmin, getAuthenticatedUserId } from "@/lib/auth";
import { getTierFromXp } from "@/lib/tier-engine";
import { createNotification } from "./notificationActions";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type AuditStatus = "verified" | "flagged";

export interface AuditMetadata {
    scanned: boolean;
    riskScore: number;
    lastAudit: string;
    status: AuditStatus;
    scanVersion: string;
    isMockScore?: boolean; // ✅ flag so UI can show "simulated" label
}

const NOTE_MIN_XP = 500;

// ─────────────────────────────────────────────────────────────────────────────
// PERFORM JUSTICE AUDIT
// ─────────────────────────────────────────────────────────────────────────────
export async function performJusticeAudit(ideaId: string) {
    try {
        const [idea] = await db
            .select({
                id: ideas.id, title: ideas.title, content: ideas.content,
                genesisHash: ideas.genesisHash, aiMetadata: ideas.aiMetadata,
                userId: ideas.userId
            })
            .from(ideas)
            .where(eq(ideas.id, ideaId));

        if (!idea) return { success: false, error: "Idea not found" };

        // ✅ Fixed: labeled as mock — real ML score goes here in Phase 5+
        const riskScore = Math.floor(Math.random() * 100);
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

        await db.update(ideas).set({
            aiMetadata: jsonbMerge(ideas.aiMetadata, auditMetadata),
            updatedAt: new Date(),
        }).where(eq(ideas.id, ideaId));

        // ✅ Fixed: only notify on real scores, not mock random ones
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
                ideaId, riskScore, status, isMockScore,
                message: status === "flagged"
                    ? `⚠️ Flagged (simulated): Risk score ${riskScore}/100`
                    : `✅ Verified (simulated): Risk score ${riskScore}/100`,
            },
        };
    } catch (error) {
        console.error("Justice Audit failed:", error);
        return { success: false, error: "Audit system error" };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH AUDIT UNSCANNED
// ─────────────────────────────────────────────────────────────────────────────
export async function batchAuditUnscanned() {
    try {
        const unscanned = await db
            .select({ id: ideas.id })
            .from(ideas)
            .where(eq(ideas.status, "public"));

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
                scannedCount, flaggedCount,
                message: `Scanned ${scannedCount} ideas. Flagged ${flaggedCount} (simulated scores).`
            },
        };
    } catch (error) {
        console.error("Batch audit failed:", error);
        return { success: false, error: "Batch audit system error" };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL OVERRIDE  (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
export async function manualOverride(
    ideaId: string,
    status: AuditStatus,
    adminNote?: string
) {
    try {
        await requireAdmin();

        await db.update(ideas).set({
            aiMetadata: jsonbMerge(ideas.aiMetadata, {
                status, manualOverride: true,
                overrideTimestamp: new Date().toISOString(),
                adminNote: adminNote ?? "Manual review",
                isMockScore: false, // manual overrides are always real
            }),
            updatedAt: new Date(),
        }).where(eq(ideas.id, ideaId));

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

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT COMMUNITY NOTE  (Architect+ only)
// ─────────────────────────────────────────────────────────────────────────────
export async function submitCommunityNote(
    ideaId: string,
    note: string,
    severity: "informational" | "factually_critical",
    supportingEvidence?: { url: string; description: string }[]
) {
    const callerId = await getAuthenticatedUserId();
    if (!callerId) return { success: false, error: "Not authenticated" };

    if (!note?.trim() || note.trim().length < 20)
        return { success: false, error: "Note must be at least 20 characters" };
    if (note.length > 2000)
        return { success: false, error: "Note too long (max 2000 chars)" };

    const [caller] = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, callerId));

    const tier = getTierFromXp(caller?.xp ?? 0);
    if ((caller?.xp ?? 0) < NOTE_MIN_XP)
        return {
            success: false,
            error: `Community notes require Architect tier (500 XP). You are ${tier.displayName} (${caller?.xp ?? 0} XP).`,
        };

    const [idea] = await db
        .select({ userId: ideas.userId, title: ideas.title })
        .from(ideas)
        .where(eq(ideas.id, ideaId));
    if (!idea) return { success: false, error: "Idea not found" };
    if (idea.userId === callerId)
        return { success: false, error: "Cannot submit a note on your own idea" };

    const [inserted] = await db.insert(communityNotes).values({
        ideaId,
        authorId: callerId,
        note: note.trim(),
        severity,
        supportingEvidence: supportingEvidence ?? [],
        threshold: 5,
    }).returning({ id: communityNotes.id });

    if (idea.userId) {
        await createNotification({
            userId: idea.userId,
            type: "critical_note",
            body: `A community note was submitted on your idea "${idea.title}" (${severity === "factually_critical" ? "⚠️ Factually Critical" : "ℹ️ Informational"})`,
            link: `/idea/${ideaId}`,
        });
    }

    revalidatePath(`/idea/${ideaId}`);
    return { success: true, noteId: inserted.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// VOTE ON COMMUNITY NOTE
// ─────────────────────────────────────────────────────────────────────────────
export async function voteCommunityNote(noteId: string) {
    const callerId = await getAuthenticatedUserId();
    if (!callerId) return { success: false, error: "Not authenticated" };

    const [updated] = await db
        .update(communityNotes)
        .set({ voteCount: sql`${communityNotes.voteCount} + 1`, updatedAt: new Date() })
        .where(eq(communityNotes.id, noteId))
        .returning({
            id: communityNotes.id,
            voteCount: communityNotes.voteCount,
            threshold: communityNotes.threshold,
            severity: communityNotes.severity,
            ideaId: communityNotes.ideaId,
            status: communityNotes.status,
        });

    if (!updated) return { success: false, error: "Note not found" };

    if (updated.voteCount >= updated.threshold && updated.status === "pending") {
        await db.update(communityNotes)
            .set({ status: "verified", updatedAt: new Date() })
            .where(eq(communityNotes.id, noteId));

        if (updated.severity === "factually_critical") {
            await db.update(ideas)
                .set({ hasCriticalNote: true, updatedAt: new Date() })
                .where(eq(ideas.id, updated.ideaId));
        }

        revalidatePath(`/idea/${updated.ideaId}`);
        revalidatePath("/admin/justice");
    }

    return { success: true, voteCount: updated.voteCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISMISS NOTE  (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
export async function dismissCommunityNote(noteId: string) {
    await requireAdmin();

    const [note] = await db
        .update(communityNotes)
        .set({ status: "dismissed", updatedAt: new Date() })
        .where(eq(communityNotes.id, noteId))
        .returning({ ideaId: communityNotes.ideaId });

    if (note) revalidatePath(`/idea/${note.ideaId}`);
    revalidatePath("/admin/justice");
    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET NOTES FOR AN IDEA
// ─────────────────────────────────────────────────────────────────────────────
export async function getCommunityNotes(ideaId: string) {
    return db
        .select({
            id: communityNotes.id,
            note: communityNotes.note,
            severity: communityNotes.severity,
            status: communityNotes.status,
            voteCount: communityNotes.voteCount,
            threshold: communityNotes.threshold,
            createdAt: communityNotes.createdAt,
            authorId: communityNotes.authorId,
            authorName: users.name,
            authorHandle: users.handle,
            authorXp: users.xp,
        })
        .from(communityNotes)
        .leftJoin(users, eq(communityNotes.authorId, users.id))
        .where(
            and(
                eq(communityNotes.ideaId, ideaId),
                sql`${communityNotes.status} != 'dismissed'`
            )
        )
        .orderBy(communityNotes.createdAt);
}
