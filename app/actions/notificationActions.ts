"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

    const [result] = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
        ));
    return result?.count ?? 0;
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

    revalidatePath("/notifications"); // ✅ add this so the page refreshes after marking read
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
