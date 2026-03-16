"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function getMyNotifications() {
    let userId: string;
    try {
        userId = await requireAuth();
    } catch {
        return [];
    }

    return db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: (n, { desc }) => [desc(n.createdAt)],
        limit: 30,
    });
}

export async function getUnreadCount() {
    let userId: string;
    try {
        userId = await requireAuth();
    } catch {
        return 0;
    }

    const unread = await db.query.notifications.findMany({
        where: and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
        ),
    });
    return unread.length;
}

export async function markAllRead() {
    let userId: string;
    try {
        userId = await requireAuth();
    } catch {
        return;
    }

    await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, userId));
}

export async function createNotification({
    userId,
    type,
    body,
    link,
}: {
    userId: string;
    type: string;
    body: string;
    link?: string;
}) {
    await db.insert(notifications).values({ userId, type, body, link });
}
