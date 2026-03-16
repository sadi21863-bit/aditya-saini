"use server";

import { db } from "@/db";
import { comments, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function addComment(ideaId: string, content: string) {
    const callerId = await getAuthenticatedUserId();

    const trimmed = content?.trim();
    if (!trimmed || trimmed.length < 1) return { success: false, error: "Comment cannot be empty" };
    if (trimmed.length > 1000) return { success: false, error: "Comment too long (max 1000 chars)" };

    await db.insert(comments).values({
        ideaId,
        userId: callerId,
        content: trimmed,
    });

    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
}

export async function deleteComment(commentId: string, ideaId: string) {
    const callerId = await getAuthenticatedUserId();

    const [comment] = await db
        .select({ userId: comments.userId })
        .from(comments)
        .where(eq(comments.id, commentId));

    if (!comment) return { success: false, error: "Comment not found" };
    if (comment.userId !== callerId) return { success: false, error: "Forbidden" };

    await db.delete(comments).where(eq(comments.id, commentId));

    revalidatePath(`/idea/${ideaId}`);
    return { success: true };
}

export async function getComments(ideaId: string) {
    const rows = await db
        .select({
            id: comments.id,
            content: comments.content,
            createdAt: comments.createdAt,
            userId: comments.userId,
            userName: users.name,
            userHandle: users.handle,
            userImage: users.image,
            userTier: users.tier,
            userXp: users.xp,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.ideaId, ideaId))
        .orderBy(desc(comments.createdAt));

    return rows.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        user: {
            id: r.userId,
            name: r.userName,
            handle: r.userHandle,
            image: r.userImage,
            tier: r.userTier,
            xp: r.userXp ?? 0,
        },
    }));
}
