import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markAllRead } from "@/app/actions/notificationActions"; // ✅ correct name

export default async function NotificationsPage() {
    let userId: string;
    try {
        userId = await getAuthenticatedUserId();
    } catch {
        redirect("/sign-in");
    }

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
                    <div className="p-2 bg-teal-50 rounded-xl">
                        <Bell className="text-[#0d9488]" size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
                        {unreadCount > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">{unreadCount} unread</p>
                        )}
                    </div>
                </div>

                {unreadCount > 0 && (
                    <form action={markAllRead}> {/* ✅ correct name */}
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2
                rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700
                hover:border-slate-300 transition-colors"
                        >
                            <CheckCheck size={13} />
                            Mark all read
                        </button>
                    </form>
                )}
            </div>

            {/* Empty state */}
            {items.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center bg-white">
                    <Bell size={28} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No notifications yet.</p>
                    <p className="text-slate-400 text-sm mt-1">
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
                                    ? "bg-white border-slate-100 text-slate-500"
                                    : "bg-teal-50/50 border-teal-100 text-slate-800"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-sm leading-snug">{n.body}</p>
                                {!n.read && (
                                    <span className="shrink-0 w-2 h-2 rounded-full bg-[#0d9488] mt-1.5" />
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5">
                                {new Date(n.createdAt!).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                })}
                            </p>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
