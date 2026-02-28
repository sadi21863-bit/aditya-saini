'use server'

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── CREATE ───────────────────────────────────────────────────────────────────
export async function addIdea(formData: FormData) {
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const hook = formData.get("hook") as string;
  const content = formData.get("content") as string;

  await db.insert(ideas).values({
    title,
    category,
    hook,
    content,
    status: "draft", // Always starts in Archive
    totalLikes: 0,
    userId: "user_test_123",
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=drafts"); // Go straight to where the new idea lives
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateIdea(id: string, formData: FormData) {
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const hook = formData.get("hook") as string;
  const content = formData.get("content") as string;

  await db.update(ideas)
    .set({ title, category, hook, content, updatedAt: new Date() })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ─── DELETE (Removed Redirect) ───────────────────────────────────────────────
export async function deleteIdea(id: string) {
  await db.delete(ideas).where(eq(ideas.id, id));

  // Revalidate ensures the card disappears immediately
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─── LAUNCH (Removed Redirect for smoother UI) ────────────────────────────────
export async function launchIdea(id: string) {
  await db.update(ideas)
    .set({ status: "public" })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  // We don't redirect here so the card just "moves" tabs in the UI
}

// ─── RECALL (Removed Redirect) ────────────────────────────────────────────────
export async function recallIdea(id: string) {
  await db.update(ideas)
    .set({ status: "draft" })
    .where(eq(ideas.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

// ─── LIKE ─────────────────────────────────────────────────────────────────────
export async function addLike(id: string) {
  try {
    await db.update(ideas)
      .set({ totalLikes: sql`${ideas.totalLikes} + 1` })
      .where(eq(ideas.id, id));

    revalidatePath("/feed");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}