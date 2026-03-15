"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function saveToHangar(formData: {
  title: string;
  context: string;   // ← was hook
  content: string;
  category: string;
  userId: string;
}) {
  try {
    await db.insert(ideas).values({
      title: formData.title,
      context: formData.context,   // ← was hook
      content: formData.content,
      category: formData.category,
      userId: formData.userId,
      status: "draft",
      totalLikes: 0,
      views: 0,
      protectionLevel: "open",             // ← was blurLevel: 0
    });

    revalidatePath("/dashboard");
    return { success: true, genesisCode: null };
  } catch (error) {
    console.error("saveToHangar failed:", error);
    return { success: false, error: "Database rejected the idea." };
  }
}
