"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="relative flex items-center justify-between px-8 py-5 border-b border-gray-200/60 dark:border-slate-800/60">
      <span className="text-xl font-bold tracking-tight text-[#0d9488]">IdeaConnect</span>

      <div className="flex items-center gap-4">
        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/explore" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Explore
          </Link>
          <Link href="/sign-in" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#0d9488] hover:bg-teal-500 text-white transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex flex-col gap-1 z-50">
          <Link href="/explore" onClick={() => setMenuOpen(false)}
            className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white text-sm py-2 transition-colors">
            Explore
          </Link>
          <Link href="/sign-in" onClick={() => setMenuOpen(false)}
            className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white text-sm py-2 transition-colors">
            Sign in
          </Link>
          <Link href="/sign-up" onClick={() => setMenuOpen(false)}
            className="text-gray-900 dark:text-white font-semibold text-sm py-2 transition-colors">
            Get started →
          </Link>
        </div>
      )}
    </nav>
  );
}
