import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markAllRead } from "@/app/actions/notificationActions";

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
        <div className="max-w-2xl mx-auto px-6 py-12">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
                        <Bell className="text-[#0d9488]" size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                        {unreadCount > 0 && (
                            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">{unreadCount} unread</p>
                        )}
                    </div>
                </div>

                {unreadCount > 0 && (
                    <form action={markAllRead}>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2
                rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400
                hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                        >
                            <CheckCheck size={13} />
                            Mark all read
                        </button>
                    </form>
                )}
            </div>

            {/* Empty state */}
            {items.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-3xl p-20 text-center bg-white dark:bg-slate-900">
                    <Bell size={28} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-gray-400 dark:text-slate-400 font-medium">No notifications yet.</p>
                    <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
                        Activity on your ideas will appear here.
                    </p>
                </div>
            )}

            {/* Notification list */}
            {items.length > 0 && (
                <div className="space-y-2">
                    {items.map((n) => (
                        <a
                            key={n.id}
                            href={n.link ?? "#"}
                            className={`block p-4 rounded-2xl border transition-all hover:border-[#0d9488]/30
                ${n.read
                                    ? "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400"
                                    : "bg-teal-50/50 dark:bg-teal-900/10 border-teal-100 dark:border-teal-900/30 text-gray-800 dark:text-slate-200"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-sm leading-snug">{n.body}</p>
                                {!n.read && (
                                    <span className="shrink-0 w-2 h-2 rounded-full bg-[#0d9488] mt-1.5" />
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">
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
