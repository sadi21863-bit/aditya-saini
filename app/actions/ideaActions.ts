"use server";

import { db } from "@/db";
import { ideas, likes, users } from "@/db/schema";
import type { AccessLevel } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getTierNameFromXp } from "@/lib/tier-engine";
import { generateGenesisHash, generateCombinedSimHash } from "@/lib/hash";


// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const IdeaWriteSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title too long"),
  category: z.string().min(1, "Category is required").max(60),
  hook: z.string().max(140, "Hook must be 140 chars or less").optional().default(""),
  content: z.string().min(1, "Content is required").max(10000),
  blurLevel: z.coerce.number().int().min(0).max(3).optional().default(0),
});

const AccessRequestSchema = z.object({
  ideaId: z.string().uuid("Invalid idea ID"),
  level: z.enum(["viewer", "partner"]),
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function assertOwnership(ideaId: string, callerId: string) {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) throw new Error("Idea not found");
  if (idea.userId !== callerId) throw new Error("Forbidden: you do not own this idea");
  return idea;
}

async function awardXp(userId: string, delta: number) {
  await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${delta}` })
    .where(eq(users.id, userId));

  const [user] = await db
    .select({ xp: users.xp })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return;

  const newTier = getTierNameFromXp(user.xp);
  await db
    .update(users)
    .set({ tier: newTier })
    .where(eq(users.id, userId));
}

// ─────────────────────────────────────────────────────────────────────────────
// ── CREATE ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function addIdea(formData: FormData) {
  const callerId = await getAuthenticatedUserId();

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    hook: formData.get("hook"),
    content: formData.get("content"),
    blurLevel: formData.get("blurLevel") ?? 0,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { title, category, hook, content, blurLevel } = parsed.data;

  await db.insert(ideas).values({
    title,
    category,
    hook,
    content,
    blurLevel,
    status: "draft",
    totalLikes: 0,
    views: 0,
    userId: callerId,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=drafts");
}

// ─────────────────────────────────────────────────────────────────────────────
// ── UPDATE ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function updateIdea(id: string, formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  await assertOwnership(id, callerId);

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    hook: formData.get("hook"),
    content: formData.get("content"),
    blurLevel: formData.get("blurLevel") ?? 0,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { title, category, hook, content, blurLevel } = parsed.data;

  await db
    .update(ideas)
    .set({ title, category, hook, content, blurLevel, updatedAt: new Date() })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath(`/idea/${id}`);
  redirect("/dashboard");
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DELETE ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  await assertOwnership(id, callerId);

  await db.delete(ideas).where(eq(ideas.id, id));
  await awardXp(callerId, -10);

  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─────────────────────────────────────────────────────────────────────────────
// ── LAUNCH  (draft → public) ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function launchIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  const idea = await assertOwnership(id, callerId);

  const launchedAt = new Date();

  // Similarity Check
  const newSimHash = await generateCombinedSimHash(
    idea.title,
    idea.content ?? ""
  );

  const duplicates = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      userId: ideas.userId,
    })
    .from(ideas)
    .where(
      and(
        eq(ideas.status, "public"),
        eq(ideas.simHash, newSimHash),
        sql`${ideas.id} != ${id}`
      )
    );

  if (duplicates.length > 0) {
    const duplicate = duplicates[0];
    return {
      success: false,
      error: "A similar idea already exists in the Genesis Registry.",
      duplicateId: duplicate.id,
      duplicateTitle: duplicate.title,
      message: `⚠️ Plagiarism Protection: An idea with nearly identical content was launched by another user. Original: "${duplicate.title}"`,
    };
  }

  const genesisHash = idea.genesisHash
    ? idea.genesisHash
    : await generateGenesisHash(
      idea.title,
      idea.content ?? "",
      callerId,
      launchedAt
    );

  // ── Initialize AI Metadata (safer version) ────────────────────────────────
  const currentMetadata = idea.aiMetadata as Record<string, any> | null;
  const aiMetadataValue = currentMetadata
    ? sql`${ideas.aiMetadata}` // Keep existing
    : sql`${JSON.stringify({ initialized: true, scanned: false })}::jsonb`; // Initialize

  await db
    .update(ideas)
    .set({
      status: "public",
      genesisHash,
      simHash: newSimHash,
      aiMetadata: aiMetadataValue,
      updatedAt: launchedAt,
    })
    .where(eq(ideas.id, id));

  if (!idea.genesisHash) {
    await awardXp(callerId, 10);
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── RECALL  (public → draft) ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function recallIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  await assertOwnership(id, callerId);

  await db
    .update(ideas)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SPARK  (Like with deduplication) ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function sparkIdea(ideaId: string, viewerId: string) {
  try {
    const existing = await db
      .select({ id: likes.id })
      .from(likes)
      .where(and(eq(likes.userId, viewerId), eq(likes.ideaId, ideaId)));

    if (existing.length > 0) {
      return { success: false, error: "Already liked" };
    }

    const [idea] = await db
      .select({ userId: ideas.userId, totalLikes: ideas.totalLikes })
      .from(ideas)
      .where(eq(ideas.id, ideaId));

    if (!idea) return { success: false, error: "Idea not found" };

    await db.insert(likes).values({ userId: viewerId, ideaId });

    await db
      .update(ideas)
      .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
      .where(eq(ideas.id, ideaId));

    if (idea.userId) {
      await awardXp(idea.userId, 5);
      await db
        .update(users)
        .set({ score: sql`${users.score} + 5` })
        .where(eq(users.id, idea.userId));
    }

    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
  } catch (error) {
    console.error("sparkIdea failed:", error);
    return { success: false, error: "Server error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PHASE 5: REQUEST ACCESS (VIEWER OR PARTNER) ───────────────────────────────
// Unified action for both access levels
// ─────────────────────────────────────────────────────────────────────────────
export async function requestAccess(ideaId: string, level: AccessLevel) {
  const callerId = await getAuthenticatedUserId();

  // Validate inputs
  const parsed = AccessRequestSchema.safeParse({ ideaId, level });
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  // Fetch the idea
  const [idea] = await db
    .select()
    .from(ideas)
    .where(eq(ideas.id, ideaId));

  if (!idea) {
    return { success: false, error: "Idea not found" };
  }

  // BLOCK: Can't request access to your own idea
  if (idea.userId === callerId) {
    return { success: false, error: "You are the Genesis Creator of this idea" };
  }

  const isViewer = idea.viewerIds?.includes(callerId) ?? false;
  const isPartner = idea.partnerIds?.includes(callerId) ?? false;

  // ── TIER 1: VIEWER ACCESS ──────────────────────────────────────────────────
  if (level === "viewer") {
    // Already a viewer
    if (isViewer) {
      return { success: false, error: "You already have Viewer access" };
    }

    // Already a partner (higher tier)
    if (isPartner) {
      return { success: false, error: "You are already a Partner (higher tier)" };
    }

    // Grant viewer access
    await db
      .update(ideas)
      .set({
        viewerIds: sql`array_append(${ideas.viewerIds}, ${callerId})`,
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, ideaId));

    // Award +5 XP
    await awardXp(callerId, 5);

    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);

    return {
      success: true,
      message: "✅ Access Granted: Content unlocked! (+5 XP)",
      level: "viewer",
    };
  }

  // ── TIER 2: PARTNER ACCESS ────────────────────────────────────────────────
  if (level === "partner") {
    // Already a partner
    if (isPartner) {
      return { success: false, error: "You are already a Partner" };
    }

    // UPGRADE LOGIC: Move from viewer to partner
    if (isViewer) {
      await db
        .update(ideas)
        .set({
          viewerIds: sql`array_remove(${ideas.viewerIds}, ${callerId})`,
          partnerIds: sql`array_append(${ideas.partnerIds}, ${callerId})`,
          updatedAt: new Date(),
        })
        .where(eq(ideas.id, ideaId));

      // Award +20 XP (since they already got +5 as viewer)
      await awardXp(callerId, 20);

      revalidatePath("/feed");
      revalidatePath(`/idea/${ideaId}`);

      return {
        success: true,
        message: "⚡ Partnership Verified: You now have Top-Shelf commenting authority! (+20 XP)",
        level: "partner",
        upgraded: true,
      };
    }

    // Fresh partner (not a viewer before)
    await db
      .update(ideas)
      .set({
        partnerIds: sql`array_append(${ideas.partnerIds}, ${callerId})`,
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, ideaId));

    // Award +25 XP
    await awardXp(callerId, 25);

    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);

    return {
      success: true,
      message: "🛡️ Partnership Verified: You now have Top-Shelf commenting authority! (+25 XP)",
      level: "partner",
    };
  }

  return { success: false, error: "Invalid access level" };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── RECORD VIEW ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function recordView(ideaId: string) {
  await db
    .update(ideas)
    .set({ views: sql`${ideas.views} + 1` })
    .where(eq(ideas.id, ideaId));
}

// ─────────────────────────────────────────────────────────────────────────────
// ── LEGACY COMPAT ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function addLike(id: string) {
  try {
    await db
      .update(ideas)
      .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
      .where(eq(ideas.id, id));
    revalidatePath("/feed");
    return { success: true };
  } catch {
    return { success: false };
  }
}
