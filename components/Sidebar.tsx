"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/feed", label: "🌐 Feed" },
  { href: "/registry", label: "🔍 Registry" },
  { href: "/leaderboard", label: "🏆 Leaderboard" },
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

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col px-4 py-6 z-50">
      {/* Logo */}
      <Link href="/feed" className="mb-8 block">
        <h2 className="text-xl font-bold text-teal-400 tracking-tight">
          IdeaConnect
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Genesis Registry</p>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${pathname === item.href
                ? "bg-teal-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
          >
            {item.label}
          </Link>
        ))}

        {currentHandle && (
          <Link
            href={`/profile/${currentHandle}`}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${pathname === `/profile/${currentHandle}`
                ? "bg-teal-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
          >
            👤 My Profile
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
        <UserButton afterSignOutUrl="/" />
        {currentHandle && (
          <span className="text-slate-400 text-sm truncate">
            @{currentHandle}
          </span>
        )}
      </div>
    </aside>
  );
}
