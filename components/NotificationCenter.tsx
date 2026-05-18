"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
    Bell, Zap, UserPlus, GitBranch,
    MessageSquare, Trophy, X, CheckCheck, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import {
    getMyNotifications,
    markAllRead,
    markOneRead,
    getUnreadCount,
} from "@/app/actions/notificationActions";

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
    critical_note: AlertTriangle,
};

const COLOR_MAP: Record<string, string> = {
    spark: "text-ic-accent",
    follow: "text-violet-400",
    access_request: "text-amber-400",
    comment: "text-blue-400",
    milestone: "text-yellow-400",
    critical_note: "text-red-400",
};

interface NotificationCenterProps {
    userId: string;
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPending, startTransition] = useTransition();
    const panelRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    useEffect(() => {
        if (isOpen && !loaded) {
            startTransition(async () => {
                const data = await getMyNotifications();
                setNotifications(data as Notification[]);
                setLoaded(true);
            });
        }
    }, [isOpen, loaded]);

    useEffect(() => {
        if (!userId) return;

        const poll = async () => {
            if (document.visibilityState !== "visible") return;
            const count = await getUnreadCount();
            setUnreadCount(count);
            if (count !== prevCountRef.current) {
                setLoaded(false);
                prevCountRef.current = count;
            }
        };

        poll();
        const interval = setInterval(poll, 30_000);
        const handleVisibility = () => {
            if (document.visibilityState === "visible") poll();
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [userId]);

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
            setUnreadCount(0);
            prevCountRef.current = 0;
        });
    }

    return (
        <div className="relative" ref={panelRef}>

            {/* Bell trigger */}
            <button
                onClick={() => setIsOpen((v) => !v)}
                aria-label="Notifications"
                aria-expanded={isOpen}
                className="relative p-2 rounded-lg hover:bg-ic-paper-deep transition-colors"
            >
                <Bell size={18} className="text-ic-muted hover:text-ic-ink transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-ic-accent-bright ring-2 ring-ic-paper" />
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-80 rounded-2xl
                    bg-ic-card border border-ic-rule shadow-card z-50 overflow-hidden">

                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-ic-rule-soft">
                        <div className="flex items-center gap-2">
                            <h3 className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ic-accent-bright text-ic-accent-ink">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    disabled={isPending}
                                    className="flex items-center gap-1 font-mono text-[11px] text-ic-accent
                                        hover:text-ic-accent-bright transition-colors disabled:opacity-50"
                                >
                                    <CheckCheck size={11} />
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg hover:bg-ic-paper-deep transition-colors"
                            >
                                <X size={14} className="text-ic-muted" />
                            </button>
                        </div>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-ic-rule-soft">
                        {isPending && !loaded ? (
                            <div className="py-8 text-center font-mono text-[11px] text-ic-muted">
                                Loading…
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 text-center">
                                <Bell size={22} className="mx-auto text-ic-muted mb-2" />
                                <p className="font-mono text-[11px] text-ic-muted">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const Icon = ICON_MAP[notif.type] ?? Bell;
                                const color = COLOR_MAP[notif.type] ?? "text-ic-muted";
                                const content = (
                                    <div
                                        key={notif.id}
                                        className={`flex gap-3 px-4 py-3 hover:bg-ic-paper-deep transition-colors
                                            border-l-2 ${!notif.read ? "border-l-ic-accent-bright" : "border-l-transparent"}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-ic-paper-deep flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon size={13} className={color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs leading-relaxed ${!notif.read ? "text-ic-ink" : "text-ic-ink-soft"}`}>
                                                {notif.body}
                                            </p>
                                            <p className="font-mono text-[10px] text-ic-muted mt-1">
                                                {relativeTime(notif.createdAt)}
                                            </p>
                                        </div>
                                        {!notif.read && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-ic-accent-bright mt-2 shrink-0" />
                                        )}
                                    </div>
                                );

                                return notif.link ? (
                                    <Link
                                        href={notif.link}
                                        key={notif.id}
                                        onClick={() => {
                                            setIsOpen(false);
                                            if (!notif.read) {
                                                markOneRead(notif.id);
                                                setNotifications((prev) =>
                                                    prev.map((n) => n.id === notif.id ? { ...n, read: true } : n)
                                                );
                                                setUnreadCount((c) => Math.max(0, c - 1));
                                            }
                                        }}
                                    >
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={notif.id}>{content}</div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-ic-rule-soft">
                        <Link
                            href="/notifications"
                            className="block text-center font-mono text-[12px] font-medium
                                text-ic-accent hover:text-ic-accent-bright transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            View all →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
