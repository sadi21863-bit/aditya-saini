"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
    Bell, Zap, UserPlus, GitBranch,
    MessageSquare, Trophy, X, CheckCheck,
} from "lucide-react";
import Link from "next/link";
import {
    getMyNotifications,
    markAllRead,
} from "@/app/actions/notificationActions";

type NotifType = "spark" | "follow" | "access_request" | "comment" | "milestone";

interface Notification {
    id: string;
    type: string;
    body: string;
    link: string | null;
    read: boolean;
    createdAt: Date | null;
}

function relativeTime(date: Date | null): string {
    if (!date) return "";
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const ICON_MAP: Record<string, React.FC<{ size: number; className?: string }>> = {
    spark: Zap,
    follow: UserPlus,
    access_request: GitBranch,
    comment: MessageSquare,
    milestone: Trophy,
};

const COLOR_MAP: Record<string, string> = {
    spark: "text-[#0d9488]",
    follow: "text-violet-400",
    access_request: "text-amber-400",
    comment: "text-blue-400",
    milestone: "text-yellow-400",
};

interface NotificationCenterProps {
    userId: string;
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isPending, startTransition] = useTransition();
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Load notifications when panel opens (only once per session)
    useEffect(() => {
        if (isOpen && !loaded) {
            startTransition(async () => {
                const data = await getMyNotifications();
                setNotifications(data as Notification[]);
                setLoaded(true);
            });
        }
    }, [isOpen, loaded]);

    // Poll unread count every 30s silently
    useEffect(() => {
        if (!userId) return;
        const interval = setInterval(async () => {
            const data = await getMyNotifications();
            setNotifications(data as Notification[]);
        }, 30_000);
        return () => clearInterval(interval);
    }, [userId]);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    function handleMarkAllRead() {
        startTransition(async () => {
            await markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        });
    }

    return (
        <div className="relative" ref={panelRef}>

            {/* Bell Button */}
            <button
                onClick={() => setIsOpen((v) => !v)}
                className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
            >
                <Bell size={18} className="text-slate-500 hover:text-slate-900 transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-11 w-80 rounded-2xl bg-white border border-slate-200
          shadow-2xl shadow-black/10 z-50 overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-[#0d9488]">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    disabled={isPending}
                                    className="flex items-center gap-1 text-xs text-[#0d9488]
                    hover:text-teal-600 font-semibold transition-colors"
                                >
                                    <CheckCheck size={12} />
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X size={14} className="text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {isPending && !loaded ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 text-center">
                                <Bell size={24} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-400 text-xs">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const Icon = ICON_MAP[notif.type] ?? Bell;
                                const color = COLOR_MAP[notif.type] ?? "text-slate-400";
                                const content = (
                                    <div
                                        key={notif.id}
                                        className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors
                      ${!notif.read
                                                ? "border-l-2 border-l-[#0d9488]"
                                                : "border-l-2 border-l-transparent"
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon size={14} className={color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-700 leading-relaxed">
                                                {notif.body}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                {relativeTime(notif.createdAt)}
                                            </p>
                                        </div>
                                        {!notif.read && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#0d9488] mt-2 shrink-0" />
                                        )}
                                    </div>
                                );

                                return notif.link ? (
                                    <Link href={notif.link} key={notif.id} onClick={() => setIsOpen(false)}>
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={notif.id}>{content}</div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-100">
                        <Link
                            href="/notifications"
                            className="block text-center text-xs font-semibold
                text-[#0d9488] hover:text-teal-600 transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            View All Notifications →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
