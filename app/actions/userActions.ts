"use server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function createUserProfile({
    userId,
    handle,
    name,
}: {
    userId: string;
    handle: string;
    name: string;
}): Promise<{ error?: string }> {
    if (!handle || handle.length < 3) {
        return { error: "Handle must be at least 3 characters." };
    }
    if (!/^[a-z0-9_]+$/.test(handle)) {
        return { error: "Only letters, numbers, and underscores allowed." };
    }
    if (!name || name.trim().length < 2) {
        return { error: "Display name must be at least 2 characters." };
    }

    const taken = await db.query.users.findFirst({
        where: eq(users.handle, handle),
    });
    if (taken) return { error: "That handle is already taken." };

    await db
        .insert(users)
        .values({
            id: userId,
            handle,
            name: name.trim(),
            email: "",
            tier: "dreamer",
            xp: 0,
            score: 0,
        })
        .onConflictDoUpdate({
            target: users.id,
            set: { handle, name: name.trim() },
        });

    return {};
}
