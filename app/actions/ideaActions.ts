"use server";

import { db } from "@/db";
import { ideas, ideaLikes, users } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth";
import { XP_EVENTS } from "@/lib/tier-engine";
import { generateGenesisHash } from "@/lib/genesis-hash";
import { writeLimiter, lightLimiter } from "@/lib/ratelimit";
import { awardXpForDomain, awardXp } from "@/lib/xp";
import { createNotification } from "@/app/actions/notificationActions";
import { canSubmitPrivate } from "@/lib/tier-engine";

const VALID_CATEGORIES = ["Tech","Design","Social","Finance","Creative","General"] as const;

const IdeaWriteSchema = z.object({
  title:       z.string().min(1).max(120),
  category:    z.enum(VALID_CATEGORIES),
  context:     z.string().max(280).optional().default(""),
  content:     z.string().min(1).max(10000),
  ipProtected: z.boolean().optional().default(false),
  tags:        z.array(z.string().max(30)).max(10).optional().default([]),
  domain:      z.enum(["private","public"]).optional().default("private"),
});

async function assertOwnership(ideaId: string, callerId: string) {
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
  if (!idea) throw new Error("Idea not found");
  if (idea.userId !== callerId) throw new Error("Forbidden");
  return idea;
}

// ─── CREATE ──────────────────────────────────────────────────────────────────
export async function addIdea(formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests"] } };

  const domain = formData.get("domain") === "public" ? "public" : "private";

  if (domain === "private") {
    const [user] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, callerId));
    if (!canSubmitPrivate(user?.tier ?? "explorer"))
      return { success: false, errors: { form: ["Private submissions require Builder tier (100 XP)"] } };
  }

  const parsedTags = typeof formData.get("tags") === "string"
    ? (formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean).slice(0, 10)
    : [];

  const ipRaw = formData.get("ipProtected");
  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"), category: formData.get("category"),
    context: formData.get("context"), content: formData.get("content"),
    ipProtected: ipRaw === "true" || ipRaw === "1" || ipRaw === "on",
    tags: parsedTags, domain,
  });
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const { title, category, context, content, ipProtected, tags } = parsed.data;
  await db.insert(ideas).values({
    title, category, context, content, ipProtected, tags,
    status: "draft", domain, totalLikes: 0, totalComments: 0, views: 0, userId: callerId,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=drafts");
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export async function updateIdea(id: string, formData: FormData) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, errors: { form: ["Not authenticated"] } };
  try { await assertOwnership(id, callerId); } catch { return { success: false, errors: { form: ["Forbidden"] } }; }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, errors: { form: ["Too many requests"] } };

  const parsedTags = typeof formData.get("tags") === "string"
    ? (formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean).slice(0, 10)
    : [];
  const ipRaw = formData.get("ipProtected");
  const parsed = IdeaWriteSchema.safeParse({
    title: formData.get("title"), category: formData.get("category"),
    context: formData.get("context"), content: formData.get("content"),
    ipProtected: ipRaw === "true" || ipRaw === "1" || ipRaw === "on",
    tags: parsedTags,
  });
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const { title, category, context, content, ipProtected, tags } = parsed.data;
  await db.update(ideas).set({ title, category, context, content, ipProtected, tags, updatedAt: new Date() }).where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath(`/idea/${id}`);
  redirect("/dashboard");
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function deleteIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };
  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  let idea: Awaited<ReturnType<typeof assertOwnership>>;
  try { idea = await assertOwnership(id, callerId); } catch { return { success: false, error: "Forbidden" }; }
  if (idea.title === "[deleted]") return { success: false, error: "Already deleted" };

  await db.update(ideas).set({ status: "draft", title: "[deleted]", content: null, context: null, updatedAt: new Date() }).where(eq(ideas.id, id));
  await awardXp(callerId, XP_EVENTS.DELETE_IDEA);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── LAUNCH ──────────────────────────────────────────────────────────────────
export async function launchIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };

  let idea: Awaited<ReturnType<typeof assertOwnership>>;
  try { idea = await assertOwnership(id, callerId); } catch { return { success: false, error: "Forbidden" }; }

  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const launchedAt = new Date();
  const domain = (idea.domain ?? "private") as "private" | "public";

  let genesisHash = idea.genesisHash ?? null;
  if (domain === "private" && !genesisHash) {
    genesisHash = await generateGenesisHash(idea.title, idea.content ?? "", callerId, launchedAt);
  }

  await db.update(ideas).set({
    status: "published",
    ...(domain === "private" && genesisHash ? { genesisHash } : {}),
    updatedAt: launchedAt,
  }).where(eq(ideas.id, id));

  const eventType = domain === "private" ? "SUBMIT_PRIVATE_IDEA" : "SUBMIT_PUBLIC_IDEA";
  const xpDelta   = domain === "private" ? XP_EVENTS.SUBMIT_PRIVATE_IDEA : XP_EVENTS.SUBMIT_PUBLIC_IDEA;
  await awardXpForDomain(callerId, xpDelta, domain, eventType, id, true);

  if (domain === "private" && genesisHash) {
    try {
      const { initiateGenesisHash } = await import("@/lib/genesis-hash-pipeline");
      await initiateGenesisHash(id, genesisHash);
    } catch { /* OTS failure must not block publish */ }
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── RECALL ──────────────────────────────────────────────────────────────────
export async function recallIdea(id: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };
  try { await assertOwnership(id, callerId); } catch { return { success: false, error: "Forbidden" }; }
  await db.update(ideas).set({ status: "draft", updatedAt: new Date() }).where(eq(ideas.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { success: true };
}

// ─── SPARK — P0.1 FIX: atomic transaction ────────────────────────────────────
export async function sparkIdea(ideaId: string) {
  const viewerId = await getAuthenticatedUserId();
  if (!viewerId) return { success: false, error: "Not authenticated" };

  try {
    const { success } = await lightLimiter.limit(viewerId);
    if (!success) return { success: false, error: "Too many requests" };

    const [idea] = await db
      .select({ userId: ideas.userId, totalLikes: ideas.totalLikes, title: ideas.title })
      .from(ideas).where(eq(ideas.id, ideaId));
    if (!idea) return { success: false, error: "Idea not found" };
    if (idea.userId === viewerId) return { success: false, error: "Cannot spark your own idea" };

    const existing = await db
      .select({ id: ideaLikes.id }).from(ideaLikes)
      .where(and(eq(ideaLikes.userId, viewerId), eq(ideaLikes.ideaId, ideaId)));
    if (existing.length > 0) return { success: false, error: "Already liked" };

    // P0.1: insert + counter in ONE transaction — eliminates race condition
    await db.transaction(async (tx) => {
      await tx.insert(ideaLikes).values({ userId: viewerId, ideaId });
      await tx.update(ideas).set({ totalLikes: sql`${ideas.totalLikes} + 1` }).where(eq(ideas.id, ideaId));
    });

    if (idea.userId) {
      await awardXp(idea.userId, XP_EVENTS.RECEIVE_LIKE);
      await createNotification({
        userId: idea.userId, type: "spark",
        body: `Someone sparked your idea "${idea.title}"`,
        link: `/idea/${ideaId}`,
      });
    }

    revalidatePath("/feed");
    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
  } catch (error) {
    console.error("sparkIdea failed:", error);
    return { success: false, error: "Server error" };
  }
}

// ─── RECORD VIEW ─────────────────────────────────────────────────────────────
export async function recordView(ideaId: string): Promise<boolean> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return false;
  const { success } = await lightLimiter.limit(`view:${userId}`);
  if (!success) return false;
  await db.update(ideas).set({ views: sql`${ideas.views} + 1` }).where(eq(ideas.id, ideaId));
  return true;
}

// ─── REMIX ───────────────────────────────────────────────────────────────────
export async function remixIdea(parentIdeaId: string) {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) return { success: false, error: "Not authenticated" };
  const { success } = await writeLimiter.limit(callerId);
  if (!success) return { success: false, error: "Too many requests" };

  const [parent] = await db
    .select({ id: ideas.id, userId: ideas.userId, domain: ideas.domain, status: ideas.status, remixedFromId: ideas.remixedFromId, title: ideas.title, category: ideas.category, tags: ideas.tags })
    .from(ideas).where(eq(ideas.id, parentIdeaId));

  if (!parent) return { success: false, error: "Idea not found" };
  if (parent.domain !== "public") return { success: false, error: "Only public ideas can be remixed" };
  if (parent.status !== "published") return { success: false, error: "Idea is not published" };
  if (parent.remixedFromId !== null) return { success: false, error: "Cannot remix a remix (max depth 1)" };

  if (parent.userId) {
    const [creator] = await db.select({ allowRemix: users.allowRemix }).from(users).where(eq(users.id, parent.userId));
    if (creator && !creator.allowRemix) return { success: false, error: "Creator has disabled remixing" };
  }

  const [inserted] = await db.insert(ideas).values({
    userId: callerId, domain: "public", title: `Remix: ${parent.title}`,
    category: parent.category, tags: parent.tags, status: "draft",
    remixedFromId: parentIdeaId, totalLikes: 0, totalComments: 0, views: 0,
  }).returning({ id: ideas.id });

  if (parent.userId) {
    await awardXpForDomain(parent.userId, XP_EVENTS.IDEA_GETS_REMIXED, "public", "IDEA_GETS_REMIXED", parentIdeaId, true);
    await createNotification({ userId: parent.userId, type: "remix", body: `Your idea "${parent.title}" was remixed!`, link: `/idea/${inserted.id}` });
  }

  revalidatePath("/dashboard");
  return { success: true, remixId: inserted.id };
}
