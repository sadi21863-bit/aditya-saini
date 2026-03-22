"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const HangarSaveSchema = z.object({
    ideaId: z.string().uuid().optional(),
    title: z.string().min(1, "Title required").max(120, "Title too long"),
    content: z.string().min(1, "Content required").max(10000, "Content too long"),
    context: z.string().max(280).optional(),
    category: z.string().max(60).optional(),
});

export async function saveToHangar(data: unknown) {
    const userId = await requireAuth();

    // Fix #44: Validate all inputs with Zod — no bare writes to the DB
    const parsed = HangarSaveSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: "Invalid input" };
    }
    const { ideaId, title, content, context, category } = parsed.data;

    if (ideaId) {
        // Update existing draft
        await db
            .update(ideas)
            .set({ title, content, context, category })
            .where(eq(ideas.id, ideaId));
    } else {
        // Create new draft
        await db.insert(ideas).values({
            userId,
            title,
            content,
            context,
            category,
            status: "draft",
        });
    }

    revalidatePath("/dashboard/studio");
    return { success: true };
}
