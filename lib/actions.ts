"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * 1. CREATE: Save a new idea to the Vault
 */
export async function addIdea(formData: FormData) {
  const title = formData.get("title") as string;
  const category = formData.get("category") as string; // Matches form 'name'
  const hook = formData.get("hook") as string;
  const content = formData.get("content") as string;

  await db.insert(ideas).values({
    title,
    category,
    hook,
    content,
    status: "draft",
    totalLikes: 0, // Simplified name from schema
    userId: "user_test_123", // Placeholder until you link Auth/Clerk
  });

  revalidatePath("/hangar");
  redirect("/hangar");
}

/**
 * 2. UPDATE: Edit an existing idea
 */
export async function updateIdea(id: string, formData: FormData) {
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const hook = formData.get("hook") as string;
  const content = formData.get("content") as string;

  await db
    .update(ideas)
    .set({
      title,
      category,
      hook,
      content,
      updatedAt: new Date(),
    })
    .where(eq(ideas.id, id));

  revalidatePath("/hangar");
  redirect("/hangar");
}

/**
 * 3. DELETE: Remove an idea
 */
export async function deleteIdea(id: string) {
  await db.delete(ideas).where(eq(ideas.id, id));

  revalidatePath("/hangar");
  redirect("/hangar");
}

/**
 * 4. LIKE: Increment the totalLikes count
 */
export async function addLike(id: string) {
  try {
    await db
      .update(ideas)
      .set({
        totalLikes: sql`${ideas.totalLikes} + 1`,
      })
      .where(eq(ideas.id, id));

    revalidatePath("/aether");
    return { success: true };
  } catch (error) {
    console.error("Failed to like idea:", error);
    return { success: false };
  }
}

/**
 * 5. PUBLISH: Move idea from draft to public
 */
export async function publishIdea(id: string) {
  await db.update(ideas)
    .set({ status: "public" })
    .where(eq(ideas.id, id));

  revalidatePath("/hangar");
  revalidatePath("/aether");
  redirect("/aether");
}