"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, LayoutDashboard, PlusCircle, Trophy, User, Zap } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "The Feed",    href: "/feed",       icon: <Rss size={18} /> },
    { name: "Dashboard",   href: "/dashboard",  icon: <LayoutDashboard size={18} /> },
    { name: "New Idea",    href: "/new",        icon: <PlusCircle size={18} /> },
    { name: "Leaderboard", href: "/leaderboard",icon: <Trophy size={18} /> },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-100 p-6 z-50 flex flex-col justify-between hidden lg:flex shadow-sm">
      <div>
        {/* BRANDING */}
        <Link href="/feed" className="flex items-center gap-3 mb-10 px-2 group">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#0d9488] to-teal-400 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <Zap size={18} fill="white" />
          </div>
          <span className="font-black tracking-tight text-xl text-slate-900" style={{ fontFamily: 'var(--font-playfair)' }}>
            Idea<span className="text-[#0d9488]">Connect</span>
          </span>
        </Link>

        {/* MENU */}
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-all ${
                isActive(item.href)
                  ? "bg-[#0d9488] text-white shadow-md"
                  : "text-slate-500 hover:text-slate-900 hover:bg-teal-50"
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* USER SECTION */}
      <div className="border-t border-slate-100 pt-6">
        <Link
          href="/profile/me"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-teal-50 transition-all"
        >
          <User size={18} />
          <span className="font-semibold text-sm">My Profile</span>
        </Link>
        <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 rounded-2xl border border-teal-100 mt-2">
          <div className="w-9 h-9 rounded-full bg-[#0d9488] flex items-center justify-center text-white font-black text-xs">
            U
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900">User</span>
            <span className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">Member</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
