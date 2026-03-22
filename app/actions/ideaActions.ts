"use server";

import { db } from "@/db";
import { ideas, likes, users, similarityFlags, ideaRevisions } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getTierNameFromXp, XP_EVENTS, canUseProtection } from "@/lib/tier-engine";
import { generateGenesisHash, generateCombinedSimHash } from "@/lib/hash";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";

const IdeaWriteSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title too long"),
  category: z.string().min(1, "Category is required").max(60),
  context: z.string().max(280).optional().default(""),
  content: z.string().min(1, "Content is required").max(10000),
  protectionLevel: z
    .enum(["open", "guarded", "shielded", "vault"])
    .optional()
    .default("open"),
  flair: z
    .enum(["research", "concept", "ready", "cofound", "built"])
    .nullable()
    .optional(),
});

// #7: only "viewer" — "partner" removed (partnerIds column doesn't exist in schema)
const AccessRequestSchema = z.object({
  ideaId: z.string().uuid("Invalid idea ID"),
  level: z.enum(["viewer"]),
});

async function assertOwnership(ideaId: string, callerId: string) {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) throw new Error("Idea not found");
  if (idea.userId !== callerId) throw new Error("Forbidden: you do not own this idea");
  return idea;
}

export async function awardXp(userId: string, delta: number) {
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

  try {
    const { checkAndAwardBadges } = await import("@/app/actions/badgeActions");
    await checkAndAwardBadges(userId);
  } catch { /* badge errors should not block XP award */ }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
export async function addIdea(formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests. Please slow down."] } };

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    context: formData.get("context"),
    content: formData.get("content"),
    protectionLevel: formData.get("protectionLevel") ?? "open",
    flair: formData.get("flair") || null,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { title, category, context, content, protectionLevel, flair } = parsed.data;

  const [callerRow] = await db.select({ xp: users.xp }).from(users).where(eq(users.id, callerId));
  const callerXp = callerRow?.xp ?? 0;
  if (!canUseProtection(callerXp, protectionLevel)) {
    return { success: false, errors: { protectionLevel: ["Your tier is too low for this protection level"] } };
  }

  await db.insert(ideas).values({
    title,
    category,
    context,
    content,
    protectionLevel,
    flair: flair ?? null,
    status: "draft",
    totalLikes: 0,
    views: 0,
    userId: callerId,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=drafts");
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateIdea(id: string, formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };

  await assertOwnership(id, callerId);

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests. Please slow down."] } };

  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    context: formData.get("context"),
    content: formData.get("content"),
    protectionLevel: formData.get("protectionLevel") ?? "open",
    flair: formData.get("flair") || null,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { title, category, context, content, protectionLevel, flair } = parsed.data;

  const [callerRow] = await db.select({ xp: users.xp }).from(users).where(eq(users.id, callerId));
  const callerXp = callerRow?.xp ?? 0;
  if (!canUseProtection(callerXp, protectionLevel)) {
    return { success: false, errors: { protectionLevel: ["Your tier is too low for this protection level"] } };
  }

  await db
    .update(ideas)
    .set({
      title,
      category,
      context,
      content,
      protectionLevel,
      flair: flair ?? null,
      updatedAt: new Date(),
    })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath(`/idea/${id}`);
  redirect("/dashboard");
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function deleteIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  await assertOwnership(id, callerId);

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  await db
    .update(ideas)
    .set({
      status: "deleted",
      title: "[deleted]",
      content: null,
      context: null,
      simHash: null,
      updatedAt: new Date(),
    })
    .where(eq(ideas.id, id));

  await awardXp(callerId, XP_EVENTS.DELETE_IDEA);

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── LAUNCH ───────────────────────────────────────────────────────────────────
export async function launchIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const idea = await assertOwnership(id, callerId);

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const launchedAt = new Date();
  const newSimHash = await generateCombinedSimHash(idea.title, idea.content ?? "");

  // #1: Fetch all public ideas' simHashes and use areSimilar() (Hamming distance) for fuzzy detection
  const publicIdeas = await db
    .select({ id: ideas.id, title: ideas.title, userId: ideas.userId, simHash: ideas.simHash })
    .from(ideas)
    .where(and(eq(ideas.status, "public"), sql`${ideas.id} != ${id}`));

  const { areSimilar } = await import("@/lib/hash");
  const nearDuplicates = publicIdeas.filter(
    (i) => i.simHash && newSimHash && areSimilar(i.simHash, newSimHash)
  );

  if (nearDuplicates.length > 0) {
    const duplicate = nearDuplicates[0];
    return {
      success: false,
      error: "A similar idea already exists in the Genesis Registry.",
      duplicates: nearDuplicates,
      duplicateId: duplicate.id,
      duplicateTitle: duplicate.title,
      message: `⚠️ Plagiarism Protection: "${duplicate.title}" already exists.`,
    };
  }

  const genesisHash = idea.genesisHash
    ? idea.genesisHash
    : await generateGenesisHash(idea.title, idea.content ?? "", callerId, launchedAt);

  const currentMetadata = idea.aiMetadata as Record<string, unknown> | null;
  const aiMetadataValue = currentMetadata
    ? sql`${ideas.aiMetadata}`
    : sql`${JSON.stringify({ initialized: true, scanned: false })}::jsonb`;

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
    await awardXp(callerId, XP_EVENTS.LAUNCH_IDEA);
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── RECALL ───────────────────────────────────────────────────────────────────
export async function recallIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  await assertOwnership(id, callerId);

  await db
    .update(ideas)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── SPARK ────────────────────────────────────────────────────────────────────
export async function sparkIdea(ideaId: string, viewerId: string) {
  try {
    const { success } = await lightLimiter.limit(viewerId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const [idea] = await db
      .select({ userId: ideas.userId, totalLikes: ideas.totalLikes })
      .from(ideas)
      .where(eq(ideas.id, ideaId));

    if (!idea) return { success: false, error: "Idea not found" };

    if (idea.userId === viewerId) {
      return { success: false, error: "Cannot spark your own idea" };
    }

    const existing = await db
      .select({ id: likes.id })
      .from(likes)
      .where(and(eq(likes.userId, viewerId), eq(likes.ideaId, ideaId)));

    if (existing.length > 0) {
      return { success: false, error: "Already liked" };
    }

    await db.insert(likes).values({ userId: viewerId, ideaId });

    await db
      .update(ideas)
      .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
      .where(eq(ideas.id, ideaId));

    // #25: xp is the canonical reputation field; score is a legacy duplicate.
    // We only increment xp here. The score field is kept in schema for now
    // but is not incremented to avoid double-counting.
    if (idea.userId) {
      await awardXp(idea.userId, XP_EVENTS.RECEIVE_LIKE);
    }

    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
  } catch (error) {
    console.error("sparkIdea failed:", error);
    return { success: false, error: "Server error" };
  }
}

// ─── REQUEST ACCESS ───────────────────────────────────────────────────────────
// #7: level is always "viewer" — "partner" option removed (no partnerIds column in schema)
export async function requestAccess(ideaId: string, level: "viewer" = "viewer") {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { success } = await lightLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests. Please slow down." };

  const parsed = AccessRequestSchema.safeParse({ ideaId, level: "viewer" });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) return { success: false, error: "Idea not found" };
  if (idea.userId === callerId) return { success: false, error: "You are the Genesis Creator" };

  const isViewer = idea.viewerIds?.includes(callerId) ?? false;
  if (isViewer) return { success: false, error: "You already have access" };

  await db
    .update(ideas)
    .set({
      viewerIds: sql`array_append(${ideas.viewerIds}, ${callerId})`,
      updatedAt: new Date(),
    })
    .where(eq(ideas.id, ideaId));

  revalidatePath("/feed");
  revalidatePath(`/idea/${ideaId}`);

  return { success: true, message: "✅ Access Granted!" };
}

// ─── RECORD VIEW ──────────────────────────────────────────────────────────────
// #42: require a valid userId, skip unauthenticated requests, rate-limit by userId
export async function recordView(ideaId: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return; // skip unauthenticated views

  const { success } = await lightLimiter.limit(`view:${userId}`);
  if (!success) return; // silently drop excess view counts

  await db
    .update(ideas)
    .set({ views: sql`${ideas.views} + 1` })
    .where(eq(ideas.id, ideaId));
}
