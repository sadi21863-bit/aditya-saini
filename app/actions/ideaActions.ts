'use server'

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── CREATE ───────────────────────────────────────────────────────────────────
// Redirects after saving so the user lands directly on their new draft.
export async function addIdea(formData: FormData) {
  const title    = formData.get("title")    as string;
  const category = formData.get("category") as string;
  const hook     = formData.get("hook")     as string;
  const content  = formData.get("content")  as string;

  await db.insert(ideas).values({
    title,
    category,
    hook,
    content,
    status:     "draft",
    totalLikes: 0,
    userId:     "user_test_123", // TODO: replace with Clerk session userId
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=drafts");
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
// Redirects back to the dashboard after saving edits.
export async function updateIdea(id: string, formData: FormData) {
  const title    = formData.get("title")    as string;
  const category = formData.get("category") as string;
  const hook     = formData.get("hook")     as string;
  const content  = formData.get("content")  as string;

  await db.update(ideas)
    .set({ title, category, hook, content, updatedAt: new Date() })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
// No redirect — revalidation makes the card disappear in-place immediately.
export async function deleteIdea(id: string) {
  await db.delete(ideas).where(eq(ideas.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─── LAUNCH (draft → public) ──────────────────────────────────────────────────
// No redirect — the card status updates in-place on the dashboard.
export async function launchIdea(id: string) {
  await db.update(ideas)
    .set({ status: "public" })
    .where(eq(ideas.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─── RECALL (public → draft) ──────────────────────────────────────────────────
// No redirect — the card status updates in-place on the dashboard.
export async function recallIdea(id: string) {
  await db.update(ideas)
    .set({ status: "draft" })
    .where(eq(ideas.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─── LIKE ─────────────────────────────────────────────────────────────────────
// Direct increment. For deduplicated liking use sparkAction.ts → sparkVision().
export async function addLike(id: string) {
  try {
    await db.update(ideas)
      .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
      .where(eq(ideas.id, id));
    revalidatePath("/feed");
    return { success: true };
  } catch {
    return { success: false };
  }
}
