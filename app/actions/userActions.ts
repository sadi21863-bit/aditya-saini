"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function updateProfile(data: {
    name: string;
    bio: string;
    avatarUrl?: string;
}) {
    const userId = await requireAuth();
    await db
        .update(users)
        .set({ name: data.name, bio: data.bio, avatarUrl: data.avatarUrl })
        .where(eq(users.id, userId));
    return { success: true };
}

export async function pinIdea(ideaId: string) {
    const userId = await requireAuth();

    const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!me) return { success: false, error: "User not found" };

    const current = me.pinnedIdeaIds ?? [];
    if (current.includes(ideaId)) return { success: true }; // already pinned
    if (current.length >= 3) return { success: false, error: "Max 3 pinned ideas" };

    await db
        .update(users)
        .set({ pinnedIdeaIds: [...current, ideaId] })
        .where(eq(users.id, userId));

    return { success: true };
}

export async function unpinIdea(ideaId: string) {
    const userId = await requireAuth();

    const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!me) return { success: false };

    const updated = (me.pinnedIdeaIds ?? []).filter((id) => id !== ideaId);
    await db
        .update(users)
        .set({ pinnedIdeaIds: updated })
        .where(eq(users.id, userId));

    return { success: true };
}
