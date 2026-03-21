"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function saveToHangar(data: {
    ideaId?: string;
    title: string;
    content: string;
    context?: string;
    category?: string;
}) {
    const userId = await requireAuth();

    if (data.ideaId) {
        // Update existing draft
        await db
            .update(ideas)
            .set({
                title: data.title,
                content: data.content,
                context: data.context,
                category: data.category,
            })
            .where(eq(ideas.id, data.ideaId));
    } else {
        // Create new draft
        await db.insert(ideas).values({
            userId,
            title: data.title,
            content: data.content,
            context: data.context,
            category: data.category,
            status: "draft",
        });
    }

    revalidatePath("/dashboard/studio");
    return { success: true };
}
