"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * 🚀 LAUNCH: Moves a vision from Archive (draft) to the Public Feed
 */
export async function launchIdea(id: string) {
    try {
        await db.update(ideas)
            .set({ status: "public" })
            .where(eq(ideas.id, id));

        // Refresh both pages so the user sees the change immediately
        revalidatePath("/dashboard");
        revalidatePath("/feed");
        return { success: true };
    } catch (e) {
        console.error("Launch failed:", e);
        return { success: false };
    }
}

/**
 * 📥 RECALL: Pulls a vision back from the Public Feed into the Archive (draft)
 */
export async function recallIdea(id: string) {
    try {
        await db.update(ideas)
            .set({ status: "draft" })
            .where(eq(ideas.id, id));

        revalidatePath("/dashboard");
        revalidatePath("/feed");
        return { success: true };
    } catch (e) {
        console.error("Recall failed:", e);
        return { success: false };
    }
}

/**
 * 🗑️ DELETE: Permanently removes the vision from the database
 */
export async function deleteIdea(id: string) {
    try {
        await db.delete(ideas).where(eq(ideas.id, id));

        revalidatePath("/dashboard");
        revalidatePath("/feed");
        return { success: true };
    } catch (e) {
        console.error("Delete failed:", e);
        return { success: false };
    }
}