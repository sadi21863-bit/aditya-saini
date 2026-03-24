"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { lightLimiter } from "@/lib/ratelimit";

export async function createUserProfile(data: {
    userId: string;
    handle: string;
    name: string;
    email: string;
}) {
    // FIX #9: Lowercase-only regex — matches the edit page validation below
    const handleRegex = /^[a-z0-9_]{3,30}$/;
    if (!handleRegex.test(data.handle)) {
        return { success: false, error: "Handle must be 3–30 characters: lowercase letters, numbers and underscores only." };
    }

    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.handle, data.handle))
        .limit(1);

    if (existing.length > 0) {
        return { success: false, error: "Handle already taken" };
    }

    await db
        .insert(users)
        .values({
            id: data.userId,
            handle: data.handle,
            name: data.name,
            email: data.email,
        })
        .onConflictDoUpdate({
            target: users.id,
            set: { handle: data.handle, name: data.name },
        });

    return { success: true };
}

export async function updateProfile(data: {
    name: string;
    bio: string;
    avatarUrl?: string;
    handle?: string;
}) {
    const userId = await requireAuth();

    const { success } = await lightLimiter.limit(userId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    if (data.handle) {
        const handleRegex = /^[a-z0-9_]{3,30}$/;
        if (!handleRegex.test(data.handle)) {
            return { success: false, error: "Handle must be 3–30 characters: lowercase letters, numbers, underscores only." };
        }
        const existing = await db.query.users.findFirst({ where: eq(users.handle, data.handle) });
        if (existing && existing.id !== userId) {
            return { success: false, error: "That handle is already taken. Please choose another." };
        }
    }

    await db
        .update(users)
        .set({
            name: data.name || null,
            bio: data.bio || null,
            avatarUrl: data.avatarUrl || null,
            ...(data.handle ? { handle: data.handle } : {}),
        })
        .where(eq(users.id, userId));
    return { success: true };
}

export async function pinIdea(ideaId: string) {
    const userId = await requireAuth();

    const { success } = await lightLimiter.limit(userId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!me) return { success: false, error: "User not found" };

    const current = me.pinnedIdeaIds ?? [];
    if (current.includes(ideaId)) return { success: true };
    if (current.length >= 3) return { success: false, error: "Max 3 pinned ideas" };

    await db
        .update(users)
        .set({ pinnedIdeaIds: [...current, ideaId] })
        .where(eq(users.id, userId));

    return { success: true };
}

export async function unpinIdea(ideaId: string) {
    const userId = await requireAuth();

    const { success } = await lightLimiter.limit(userId);
    if (!success) return { success: false, error: "Too many requests. Please slow down." };

    const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!me) return { success: false, error: "User not found" };

    const updated = (me.pinnedIdeaIds ?? []).filter((id) => id !== ideaId);
    await db
        .update(users)
        .set({ pinnedIdeaIds: updated })
        .where(eq(users.id, userId));

    return { success: true };
}
