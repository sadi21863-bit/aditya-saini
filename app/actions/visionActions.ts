"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

    const parsed = HangarSaveSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: "Invalid input" };
    }
    const { ideaId, title, content, context, category } = parsed.data;

    if (ideaId) {
        // FIX #2: Verify the caller owns this draft before updating
        const existing = await db
            .select({ id: ideas.id })
            .from(ideas)
            .where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId)));

        if (!existing[0]) {
            return { success: false, error: "Forbidden" };
        }

        await db
            .update(ideas)
            .set({ title, content, context, category })
            .where(eq(ideas.id, ideaId));

        revalidatePath("/dashboard/studio");
        // FIX #15: Return id so DraftingLab can track and reuse the same draft
        return { success: true, id: ideaId };
    } else {
        // Create new draft
        const [inserted] = await db.insert(ideas).values({
            userId,
            title,
            content,
            context,
            category,
            status: "draft",
        }).returning({ id: ideas.id });

        revalidatePath("/dashboard/studio");
        // FIX #15: Return the new id so subsequent saves update rather than re-insert
        return { success: true, id: inserted?.id ?? null };
    }
}
