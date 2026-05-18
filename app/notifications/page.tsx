export const metadata = { title: "Notifications — IdeaConnect" };

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markAllRead } from "@/app/actions/notificationActions";

const FILTER_TABS = ["All", "Mentions", "Sparks", "Replies", "AI responses"];

export default async function NotificationsPage() {
    const userId = await getAuthenticatedUserId();
    if (!userId) redirect("/sign-in");

    const items = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

    const unreadCount = items.filter((n) => !n.read).length;

    return (
        <div className="max-w-2xl mx-auto px-6 py-10">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink leading-tight">
                        Notifications
                    </h1>
                    {unreadCount > 0 && (
                        <span className="bg-ic-accent-bright text-ic-accent-ink font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>

                {unreadCount > 0 && (
                    <form action={markAllRead}>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5
                                border border-ic-rule hover:border-ic-accent text-ic-muted hover:text-ic-ink
                                font-mono text-[11px] rounded-lg transition-colors"
                        >
                            <CheckCheck size={12} />
                            Mark all read
                        </button>
                    </form>
                )}
            </div>

            {/* Filter tabs — visual, All active */}
            <div className="flex gap-5 border-b border-ic-rule mb-6">
                {FILTER_TABS.map((tab, i) => (
                    <span
                        key={tab}
                        className={`pb-3 font-mono text-[11px] font-medium cursor-default select-none ${
                            i === 0
                                ? "border-b-2 border-ic-ink text-ic-ink -mb-px"
                                : "text-ic-muted hover:text-ic-ink-soft"
                        }`}
                    >
                        {tab}
                    </span>
                ))}
            </div>

            {/* Empty state */}
            {items.length === 0 && (
                <div className="bg-ic-card border border-ic-rule rounded-2xl py-20 text-center">
                    <p className="font-mono text-sm text-ic-muted">No notifications yet.</p>
                    <p className="font-mono text-[11px] text-ic-muted mt-1">
                        Activity on your ideas will appear here.
                    </p>
                </div>
            )}

            {/* Notification list */}
            {items.length > 0 && (
                <div className="flex flex-col gap-1">
                    {items.map((n) => (
                        <a
                            key={n.id}
                            href={n.link ?? "#"}
                            className={`block px-5 py-4 rounded-xl border-l-2 transition-colors
                                hover:bg-ic-paper-deep
                                ${n.read
                                    ? "border-l-transparent"
                                    : "border-l-ic-accent-bright bg-ic-card"
                                }`}
                        >
                            <p className={`text-sm leading-relaxed ${n.read ? "text-ic-ink-soft" : "text-ic-ink"}`}>
                                {n.body}
                            </p>
                            <p className="font-mono text-[11px] text-ic-muted mt-1.5">
                                {new Date(n.createdAt!).toLocaleDateString("en-IN", {
                                    month: "short", day: "numeric",
                                    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
                                })}
                            </p>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
