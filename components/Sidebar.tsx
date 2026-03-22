"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";

const NAV = [
  { href: "/feed", label: "🌐 Feed" },
  { href: "/registry", label: "🔍 Registry" },
  { href: "/leaderboard", label: "🏆 Leaderboard" },
  { href: "/bookmarks", label: "🔖 Bookmarks" },
  { href: "/dashboard", label: "⚡ My Workspace" },
  { href: "/new", label: "✦ New Idea" },
];

export default function Sidebar({
  currentUserId,
  currentHandle,
}: {
  currentUserId: string;
  currentHandle: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800
          flex flex-col py-6 z-50 transition-all duration-300
          ${collapsed ? "w-16 px-2" : "w-64 px-4"}`}
      >
        {/* Logo */}
        <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link href="/feed" className="block">
              <h2 className="text-xl font-bold text-teal-400 tracking-tight">
                IdeaConnect
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Genesis Registry</p>
            </Link>
          )}
          {collapsed && (
            <Link href="/feed" className="text-teal-400 font-black text-lg">
              IC
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2 rounded-lg text-sm font-medium transition
                  ${collapsed ? "px-2 py-2 justify-center" : "px-3 py-2"}
                  ${isActive
                    ? "bg-teal-700 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
              >
                {/* Emoji icon always shown */}
                <span className="text-base leading-none shrink-0">
                  {item.label.split(" ")[0]}
                </span>
                {/* Label only when expanded */}
                {!collapsed && (
                  <span>{item.label.split(" ").slice(1).join(" ")}</span>
                )}
              </Link>
            );
          })}

          {/* Profile link */}
          {currentHandle && (
            <Link
              href={`/profile/${currentHandle}`}
              title={collapsed ? "My Profile" : undefined}
              className={`flex items-center gap-2 rounded-lg text-sm font-medium transition
                ${collapsed ? "px-2 py-2 justify-center" : "px-3 py-2"}
                ${pathname === `/profile/${currentHandle}`
                  ? "bg-teal-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
            >
              <span className="text-base leading-none shrink-0">👤</span>
              {!collapsed && <span>My Profile</span>}
            </Link>
          )}
        </nav>

        {/* Bottom: Notifications + User */}
        <div className={`mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3
          ${collapsed ? "items-center" : ""}`}>

          {/* Notification Bell */}
          {currentUserId && (
            <div className={collapsed ? "" : "px-1"}>
              <NotificationCenter userId={currentUserId} />
            </div>
          )}

          {/* User row */}
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <UserButton />
            {!collapsed && currentHandle && (
              <span className="text-slate-400 text-sm truncate">
                @{currentHandle}
              </span>
            )}
          </div>
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-slate-700
            border border-slate-600 flex items-center justify-center
            hover:bg-slate-600 transition-colors z-10 shadow"
        >
          {collapsed
            ? <ChevronRight size={12} className="text-slate-300" />
            : <ChevronLeft size={12} className="text-slate-300" />
          }
        </button>
      </aside>

      {/* ── Spacer so main content shifts with sidebar ──────────────── */}
      <div className={`transition-all duration-300 ${collapsed ? "w-16" : "w-64"} shrink-0`} />
    </>
  );
}
