'use server'

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// 1. SCRAP — Delete an idea
export async function scrapVision(ideaId: string) {
    try {
        await db.delete(ideas).where(eq(ideas.id, ideaId));
        revalidatePath("/hangar");
        revalidatePath("/vault");
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

// 2. LAUNCH — Move idea from hangar to public aether
// (also exported as launchToAether for HangarCard compatibility)
export async function launchToAether(ideaId: string) {
    await db.update(ideas)
        .set({ status: "public" })
        .where(eq(ideas.id, ideaId));

    revalidatePath("/hangar");
    revalidatePath("/aether");
    redirect("/aether");
}

export { launchToAether as launchVision };
