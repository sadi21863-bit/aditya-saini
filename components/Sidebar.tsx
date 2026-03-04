"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Lightbulb,
  LayoutDashboard,
  PlusCircle,
  Trophy,
  User,
  Zap,
  Shield,
  Sparkles,
  Rss,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "The Feed", href: "/feed", icon: Rss },
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Profile", href: "/profile/user_test_123", icon: User },
    { name: "Justice Engine", href: "/admin/justice", icon: Shield },
    { name: "New Idea", href: "/new", icon: PlusCircle },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  ];

  // Exact-match for dashboard so /dashboard/studio gets its own highlight
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-100 p-6 z-50 flex flex-col justify-between hidden lg:flex shadow-sm">
      <div className="flex flex-col h-full">
        {/* BRANDING */}
        <Link href="/feed" className="flex items-center gap-3 mb-10 px-2 group">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#0d9488] to-teal-400 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <Zap size={18} fill="white" />
          </div>
          <span
            className="font-black tracking-tight text-xl text-slate-900"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Idea<span className="text-[#0d9488]">Connect</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${active
                    ? "bg-teal-50 text-[#0d9488] font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#0d9488]"
                  }`}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* USER SECTION */}
        <div className="border-t border-slate-100 pt-6 mt-6">
          <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 rounded-2xl border border-teal-100">
            <div className="w-9 h-9 rounded-full bg-[#0d9488] flex items-center justify-center text-white font-black text-xs">
              U
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900">Test User</span>
              <span className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">
                Initiate
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
