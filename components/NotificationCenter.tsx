"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Zap, UserPlus, GitBranch, X, CheckCheck } from "lucide-react";
import Link from "next/link";

type NotifType = "spark" | "follow" | "access";

interface Notification {
    id: string;
    type: NotifType;
    text: string;
    timestamp: Date;
    read: boolean;
}

// Mock data — replace with real DB fetch when notifications table is ready
const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: "1",
        type: "spark",
        text: '@alice sparked your idea "AI for Climate Change"',
        timestamp: new Date(Date.now() - 1000 * 60 * 14),
        read: false,
    },
    {
        id: "2",
        type: "follow",
        text: "@raj_builds started following you",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: false,
    },
    {
        id: "3",
        type: "access",
        text: '@priya_dev requested access to your idea "Quantum UI Framework"',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        read: true,
    },
];

function relativeTime(date: Date): string {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const ICON_MAP: Record<NotifType, React.FC<{ size: number; className?: string }>> = {
    spark: Zap,
    follow: UserPlus,
    access: GitBranch,
};

const COLOR_MAP: Record<NotifType, string> = {
    spark: "text-[#0d9488]",
    follow: "text-violet-400",
    access: "text-amber-400",
};

interface NotificationCenterProps {
    userId: string;
}

export default function NotificationCenter({
    userId: _userId,
}: NotificationCenterProps) {
    const [notifications, setNotifications] =
        useState<Notification[]>(MOCK_NOTIFICATIONS);
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        if (isOpen) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    function markAllRead() {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }

    return (
        <div className="relative" ref={panelRef}>

            {/* Bell Button */}
            <button
                onClick={() => setIsOpen((v) => !v)}
                className="relative p-2 rounded-full hover:bg-slate-800 transition-colors"
                aria-label="Notifications"
            >
                <Bell size={18} className="text-slate-400 hover:text-white transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-950" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="absolute right-0 top-11 w-80 rounded-2xl bg-slate-900
            border border-slate-700 shadow-2xl shadow-black/50 z-50 overflow-hidden"
                >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#0d9488]/20 text-[#0d9488]">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="flex items-center gap-1 text-xs text-[#0d9488]
                    hover:text-teal-400 font-semibold transition-colors"
                                >
                                    <CheckCheck size={12} />
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X size={14} className="text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                        {notifications.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">
                                No notifications yet
                            </p>
                        ) : (
                            notifications.map((notif) => {
                                const Icon = ICON_MAP[notif.type];
                                const color = COLOR_MAP[notif.type];
                                return (
                                    <div
                                        key={notif.id}
                                        className={`flex gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors
                      ${!notif.read
                                                ? "border-l-2 border-l-[#0d9488]"
                                                : "border-l-2 border-l-transparent"
                                            }`}
                                    >
                                        {/* Icon */}
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon size={14} className={color} />
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                {notif.text}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                {relativeTime(notif.timestamp)}
                                            </p>
                                        </div>

                                        {/* Unread dot */}
                                        {!notif.read && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#0d9488] mt-2 shrink-0" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-800">
                        <Link
                            href="/notifications"
                            className="block text-center text-xs font-semibold
                text-[#0d9488] hover:text-teal-400 transition-colors"
                        >
                            View All Notifications →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
