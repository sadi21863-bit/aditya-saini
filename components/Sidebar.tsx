"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  Home, LayoutDashboard, Compass, Bookmark,
  Plus, FlaskConical, Archive, User,
  ChevronLeft, ChevronRight, LogOut, Menu, X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import NotificationCenter from "@/components/NotificationCenter";

const NAV_ITEMS = [
  { href: "/feed",           label: "Home Feed",   icon: Home },
  { href: "/dashboard",      label: "My Rooms",    icon: LayoutDashboard },
  { href: "/explore",        label: "Explore",     icon: Compass },
  { href: "/bookmarks",      label: "Bookmarks",   icon: Bookmark },
  { href: "/rooms/new",      label: "New Room",    icon: Plus },
  { href: "/ai-lab",         label: "AI Lab",      icon: FlaskConical },
  { href: "/ai-lab/archive", label: "Lab Archive", icon: Archive },
];

const NO_SIDEBAR_PREFIXES = ["/sign-in", "/sign-up", "/onboarding"];

export default function Sidebar({
  currentUserId,
  currentHandle,
}: {
  currentUserId: string;
  currentHandle: string;
}) {
  const pathname   = usePathname();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const reduce = useReducedMotion();

  const isLanding  = pathname === "/";
  const isAuthPage = NO_SIDEBAR_PREFIXES.some((p) => pathname.startsWith(p));
  if (isLanding || isAuthPage) return null;

  function isActive(href: string) {
    if (href === "/feed")           return pathname === "/feed" || pathname.startsWith("/idea");
    if (href === "/dashboard")      return pathname === "/dashboard";
    if (href === "/rooms/new")      return pathname === "/rooms/new";
    if (href === "/explore")        return pathname === "/explore";
    if (href === "/ai-lab")         return pathname === "/ai-lab";
    if (href === "/ai-lab/archive") return pathname.startsWith("/ai-lab/archive");
    return pathname.startsWith(href);
  }

  const linkCls = (href: string, extra = "") =>
    `flex items-center gap-3 rounded-lg text-sm font-medium transition px-3 py-2 ${extra} ${
      isActive(href) ? "bg-teal-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <>
      {/* ── Mobile hamburger trigger ─────────────────────────────────── */}
      {!mobileOpen && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 text-white shadow-lg"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* ── Mobile drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="md:hidden fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 flex flex-col py-6 px-4"
              initial={{ x: reduce ? 0 : -256 }}
              animate={{ x: 0 }}
              exit={{ x: reduce ? 0 : -256 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
            >
              {/* Logo + close */}
              <div className="flex items-center justify-between mb-8">
                <Link href="/feed" onClick={() => setMobileOpen(false)}>
                  <h2 className="text-xl font-bold text-teal-400 tracking-tight">IdeaConnect</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Build ideas together</p>
                </Link>
                <button
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-1 flex-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={linkCls(item.href)}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
                {currentHandle && (
                  <Link
                    href={`/profile/${currentHandle}`}
                    onClick={() => setMobileOpen(false)}
                    className={linkCls(`/profile/${currentHandle}`)}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>My Profile</span>
                  </Link>
                )}
              </nav>

              {/* Bottom: notifications + avatar + sign out */}
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3">
                {currentUserId && <NotificationCenter userId={currentUserId} />}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center shrink-0 text-xs font-bold text-white uppercase">
                    {currentHandle ? currentHandle.charAt(0) : "?"}
                  </div>
                  <span className="text-slate-300 text-sm truncate">@{currentHandle}</span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800
          flex-col py-6 z-50 transition-all duration-300
          ${collapsed ? "w-16 px-2" : "w-64 px-4"}`}
      >
        {/* Logo */}
        <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed ? (
            <Link href="/feed" className="block">
              <h2 className="text-xl font-bold text-teal-400 tracking-tight">IdeaConnect</h2>
              <p className="text-xs text-slate-500 mt-0.5">Build ideas together</p>
            </Link>
          ) : (
            <Link href="/feed" className="text-teal-400 font-black text-lg">IC</Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2 rounded-lg text-sm font-medium transition
                ${collapsed ? "px-2 py-2 justify-center" : "px-3 py-2"}
                ${isActive(item.href)
                  ? "bg-teal-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
            >
              <item.icon className={`shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}

          {currentHandle && (
            <Link
              href={`/profile/${currentHandle}`}
              title={collapsed ? "My Profile" : undefined}
              className={`flex items-center gap-2 rounded-lg text-sm font-medium transition
                ${collapsed ? "px-2 py-2 justify-center" : "px-3 py-2"}
                ${pathname.startsWith("/profile")
                  ? "bg-teal-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
            >
              <User className={`shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`} />
              {!collapsed && <span>My Profile</span>}
            </Link>
          )}
        </nav>

        {/* Bottom */}
        <div className={`mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3 ${collapsed ? "items-center" : ""}`}>
          {currentUserId && (
            <div className={collapsed ? "" : "px-1"}>
              <NotificationCenter userId={currentUserId} />
            </div>
          )}
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            >
              <LogOut size={16} />
            </button>
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center shrink-0 text-xs font-bold text-white uppercase">
                  {currentHandle ? currentHandle.charAt(0) : "?"}
                </div>
                {currentHandle && (
                  <span className="text-slate-300 text-sm truncate">@{currentHandle}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-slate-700
            border border-slate-600 flex items-center justify-center
            hover:bg-slate-600 transition-colors z-10 shadow"
        >
          {collapsed
            ? <ChevronRight size={12} className="text-slate-300" />
            : <ChevronLeft  size={12} className="text-slate-300" />}
        </button>
      </aside>

      {/* Spacer — desktop only */}
      <div className={`hidden md:block transition-all duration-300 ${collapsed ? "w-16" : "w-64"} shrink-0`} />
    </>
  );
}
