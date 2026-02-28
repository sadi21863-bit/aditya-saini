"use server";

import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function launchIdea(id: string) {
    await db.update(ideas).set({ status: "public" }).where(eq(ideas.id, id));
    revalidatePath("/dashboard");
    revalidatePath("/feed");
}

export async function recallIdea(id: string) {
    await db.update(ideas).set({ status: "draft" }).where(eq(ideas.id, id));
    revalidatePath("/dashboard");
    revalidatePath("/feed");
}

export async function deleteIdea(id: string) {
    await db.delete(ideas).where(eq(ideas.id, id));
    revalidatePath("/dashboard");
    revalidatePath("/feed");
}