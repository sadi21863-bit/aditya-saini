"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Home, LayoutDashboard, Compass, Bookmark,
  Plus, FlaskConical, Archive, User,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import NotificationCenter from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/feed",           label: "Home Feed",   icon: Home,            isLab: false },
  { href: "/dashboard",      label: "My Rooms",    icon: LayoutDashboard, isLab: false },
  { href: "/explore",        label: "Explore",     icon: Compass,         isLab: false },
  { href: "/bookmarks",      label: "Bookmarks",   icon: Bookmark,        isLab: false },
  { href: "/rooms/new",      label: "New Room",    icon: Plus,            isLab: false },
  { href: "/ai-lab",         label: "AI Lab",      icon: FlaskConical,    isLab: true  },
  { href: "/ai-lab/archive", label: "Lab Archive", icon: Archive,         isLab: false },
] as const;

const NO_SIDEBAR_PREFIXES = ["/sign-in", "/sign-up", "/onboarding"];

export default function Sidebar({
  currentUserId,
  currentHandle,
}: {
  currentUserId: string;
  currentHandle: string;
}) {
  const pathname   = usePathname();
  const router     = useRouter();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  const reduce = useReducedMotion();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setMobileOpen(false);
    }
  }

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

  const navItemCls = (href: string) =>
    `flex items-center gap-3 px-[10px] min-h-9 rounded-lg transition ${
      isActive(href)
        ? "bg-ic-paper border border-ic-rule text-ic-ink font-semibold"
        : "text-ic-ink-soft hover:bg-ic-paper hover:text-ic-ink border border-transparent"
    }`;

  const collapsedNavItemCls = (href: string) =>
    `w-10 h-10 rounded-lg flex items-center justify-center transition border ${
      isActive(href)
        ? "bg-ic-paper border-ic-rule text-ic-ink"
        : "text-ic-muted hover:text-ic-ink border-transparent"
    }`;

  return (
    <>
      {/* ── Mobile hamburger trigger ─────────────────────────────────── */}
      {!mobileOpen && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-ic-card border border-ic-rule text-ic-ink shadow-card"
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
              className="md:hidden fixed inset-0 ic-drawer-overlay z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="md:hidden fixed top-0 left-0 h-full w-64 bg-ic-card border-r border-ic-rule z-50 flex flex-col"
              initial={{ x: reduce ? 0 : -256 }}
              animate={{ x: 0 }}
              exit={{ x: reduce ? 0 : -256 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
            >
              {/* Logo + close */}
              <div className="flex items-center justify-between px-[18px] py-4 border-b border-ic-rule-soft">
                <Link href="/feed" onClick={() => setMobileOpen(false)}>
                  <span className="font-display text-[17px] font-medium text-ic-ink tracking-tight leading-none">
                    ideaconnect<span className="text-ic-accent-bright">.</span>
                  </span>
                </Link>
                <button
                  className="text-ic-muted hover:text-ic-ink transition"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User block */}
              <div className="flex items-center gap-2 px-[18px] py-3 border-b border-ic-rule-soft">
                <div className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-xs font-bold font-mono text-white uppercase bg-ic-accent">
                  {currentHandle ? currentHandle.charAt(0) : "?"}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[12px] font-semibold text-ic-ink truncate">@{currentHandle}</div>
                </div>
              </div>

              {/* Search */}
              <div className="px-[14px] pt-3 pb-2">
                <form onSubmit={handleSearch}>
                  <div className="flex items-center gap-2 bg-ic-paper border border-ic-rule rounded-[10px] h-9 px-[10px]">
                    <Search size={13} className="text-ic-muted shrink-0" />
                    <input
                      type="search"
                      placeholder="Search…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none font-mono text-[11px] text-ic-ink placeholder:text-ic-muted"
                    />
                  </div>
                </form>
              </div>

              {/* Nav */}
              <div className="px-[14px] flex-1 overflow-y-auto">
                <p className="font-mono text-[10px] text-ic-muted uppercase tracking-widest px-2 py-2">Navigate</p>
                <nav className="flex flex-col gap-0.5">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={navItemCls(item.href)}
                    >
                      <item.icon size={16} className={`shrink-0 ${isActive(item.href) ? "text-ic-ink" : "text-ic-muted"}`} />
                      <span className="flex-1 text-[13px]">{item.label}</span>
                      {item.isLab && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-ic-accent-bright animate-pulse" />
                          <span className="font-mono text-[9px] text-ic-accent uppercase font-semibold tracking-wide">Live</span>
                        </span>
                      )}
                    </Link>
                  ))}
                  {currentHandle && (
                    <Link
                      href={`/profile/${currentHandle}`}
                      onClick={() => setMobileOpen(false)}
                      className={navItemCls(`/profile/${currentHandle}`)}
                    >
                      <User size={16} className={`shrink-0 ${pathname.startsWith("/profile") ? "text-ic-ink" : "text-ic-muted"}`} />
                      <span className="flex-1 text-[13px]">My Profile</span>
                    </Link>
                  )}
                </nav>
              </div>

              {/* Bottom */}
              <div className="border-t border-ic-rule px-[14px] py-3 flex flex-col gap-3">
                {currentUserId && <NotificationCenter userId={currentUserId} />}
                <ThemeToggle collapsed={false} />
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 text-sm font-mono text-ic-muted hover:text-ic-ink transition"
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
        className={`hidden md:flex fixed left-0 top-0 h-screen bg-ic-paper-deep border-r border-ic-rule
          flex-col z-50 transition-all duration-300
          ${collapsed ? "w-14 items-center py-3 gap-2" : "w-64"}`}
      >
        {collapsed ? (
          /* ── Collapsed (56 px) ── */
          <>
            {/* Logo mark */}
            <Link href="/feed" title="IdeaConnect">
              <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                <circle cx="7" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
                <circle cx="15" cy="11" r="2.6" fill="#22C55E" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
                <path d="M9.6 11 H12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-ic-ink" />
              </svg>
            </Link>

            {/* Expand button */}
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="w-7 h-7 border border-ic-rule rounded flex items-center justify-center text-ic-muted hover:text-ic-ink transition"
            >
              <ChevronRight size={13} />
            </button>

            <div className="w-7 h-px bg-ic-rule" />

            {/* Nav icons */}
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`${collapsedNavItemCls(item.href)} relative`}
                >
                  <item.icon size={17} />
                  {item.isLab && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-ic-accent-bright animate-pulse" />
                  )}
                </Link>
              ))}
              {currentHandle && (
                <Link
                  href={`/profile/${currentHandle}`}
                  title="My Profile"
                  className={collapsedNavItemCls(`/profile/${currentHandle}`)}
                >
                  <User size={17} />
                </Link>
              )}
            </div>

            <div className="flex-1" />

            {/* New idea FAB */}
            <Link
              href="/rooms/new"
              title="New idea"
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-ic-accent text-white hover:opacity-90 transition"
            >
              <Plus size={16} />
            </Link>

            <div className="w-7 h-px bg-ic-rule" />

            <ThemeToggle collapsed={true} />

            {/* Avatar */}
            <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold font-mono text-white uppercase bg-ic-accent">
              {currentHandle ? currentHandle.charAt(0) : "?"}
            </div>
          </>
        ) : (
          /* ── Full (240 px) ── */
          <>
            {/* Logo row */}
            <div className="flex items-center justify-between px-[18px] pt-5 pb-4">
              <Link href="/feed" className="font-display text-[17px] font-medium text-ic-ink tracking-tight leading-none">
                ideaconnect<span className="text-ic-accent-bright">.</span>
              </Link>
              <button
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                className="border border-ic-rule rounded flex items-center justify-center text-ic-muted hover:text-ic-ink transition w-[26px] h-[26px]"
              >
                <ChevronLeft size={13} />
              </button>
            </div>

            {/* Search */}
            <div className="px-[14px] pb-4">
              <form onSubmit={handleSearch}>
                <div className="flex items-center gap-2 bg-ic-paper border border-ic-rule rounded-[10px] h-9 px-[10px]">
                  <Search size={13} className="text-ic-muted shrink-0" />
                  <input
                    type="search"
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none font-mono text-[11px] text-ic-ink placeholder:text-ic-muted"
                  />
                  <span className="font-mono text-[9px] text-ic-muted border border-ic-rule rounded px-1">⌘K</span>
                </div>
              </form>
            </div>

            {/* Nav */}
            <div className="px-[14px] flex-1 overflow-y-auto">
              <p className="font-mono text-[10px] text-ic-muted uppercase tracking-widest px-2 py-2">Navigate</p>
              <nav className="flex flex-col gap-0.5">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navItemCls(item.href)}
                  >
                    <item.icon size={16} className={`shrink-0 ${isActive(item.href) ? "text-ic-ink" : "text-ic-muted"}`} />
                    <span className="flex-1 text-[13px]">{item.label}</span>
                    {item.isLab && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-ic-accent-bright animate-pulse" />
                        <span className="font-mono text-[9px] text-ic-accent uppercase font-semibold tracking-wide">Live</span>
                      </span>
                    )}
                  </Link>
                ))}
                {currentHandle && (
                  <Link
                    href={`/profile/${currentHandle}`}
                    className={navItemCls(`/profile/${currentHandle}`)}
                  >
                    <User size={16} className={`shrink-0 ${pathname.startsWith("/profile") ? "text-ic-ink" : "text-ic-muted"}`} />
                    <span className="flex-1 text-[13px]">My Profile</span>
                  </Link>
                )}
              </nav>

              {/* Notifications */}
              {currentUserId && (
                <div className="mt-2">
                  <NotificationCenter userId={currentUserId} />
                </div>
              )}
            </div>

            {/* New idea button */}
            <div className="px-[14px] pb-3">
              <Link
                href="/rooms/new"
                className="flex items-center justify-center gap-1.5 bg-ic-accent text-white rounded-lg w-full h-10 font-sans text-[13px] font-medium hover:opacity-90 transition"
              >
                <Plus size={14} /> New idea
              </Link>
            </div>

            {/* User row */}
            <div className="border-t border-ic-rule px-[14px] py-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-xs font-bold font-mono text-white uppercase bg-ic-accent">
                {currentHandle ? currentHandle.charAt(0) : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[12px] font-semibold text-ic-ink truncate">@{currentHandle}</div>
              </div>
              <ThemeToggle collapsed={true} />
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                title="Sign out"
                className="text-ic-muted hover:text-ic-ink transition p-1"
              >
                <LogOut size={14} />
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Spacer — desktop only */}
      <div className={`hidden md:block transition-all duration-300 ${collapsed ? "w-14" : "w-64"} shrink-0`} />
    </>
  );
}
