// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  PlusCircle,
  Trophy,
  User,
  Search,
} from "lucide-react";

interface SidebarProps {
  currentUserId: string;
}

export default function Sidebar({ currentUserId }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    {
      href: "/feed",
      label: "Feed",
      icon: <Newspaper size={20} />,
    },
    {
      href: "/new",
      label: "New Idea",
      icon: <PlusCircle size={20} />,
    },
    {
      href: "/registry",
      label: "Global Registry",
      icon: <Search size={20} />,
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: <Trophy size={20} />,
    },
    {
      href: `/profile/${currentUserId}`,
      label: "My Profile",
      icon: <User size={20} />,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 w-64 bg-white border-r border-slate-100 h-screen p-6 flex flex-col z-40">
      {/* Logo */}
      <div className="mb-8">
        <Link href="/dashboard">
          <h2
            className="text-2xl font-bold text-[#0d9488] hover:text-[#0f766e] transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            IdeaConnect
          </h2>
        </Link>
        <p className="text-xs text-slate-500 mt-1">Where Ideas Unite</p>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-2 flex-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${isActive
                  ? "bg-[#0d9488] text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
            >
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="pt-6 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center">
          © 2026 IdeaConnect
        </p>
        <p className="text-xs text-slate-400 text-center mt-1">
          Version 9.0
        </p>
      </div>
    </aside>
  );
}
