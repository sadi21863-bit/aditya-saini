"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="relative flex items-center justify-between px-12 py-5 border-b border-ic-rule-soft">
      {/* Wordmark */}
      <div className="flex items-center gap-2">
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="7" cy="11" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
          <circle cx="15" cy="11" r="2.6" fill="#22C55E" stroke="currentColor" strokeWidth="1.4" className="text-ic-ink" />
          <path d="M9.6 11 H12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-ic-ink" />
        </svg>
        <span className="font-display text-lg font-medium text-ic-ink tracking-tight leading-none">
          ideaconnect<span className="text-ic-accent-bright">.</span>
        </span>
      </div>

      {/* Desktop right group */}
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex items-center gap-7 text-sm font-medium text-ic-muted mr-2">
          <Link href="/ai-lab"  className="hover:text-ic-ink transition-colors">AI Lab</Link>
          <Link href="/explore" className="hover:text-ic-ink transition-colors">Explore</Link>
        </nav>
        <ThemeToggle collapsed />
        <Link
          href="/sign-in"
          className="px-4 py-2 rounded-lg border border-ic-rule text-ic-ink text-sm font-medium hover:bg-ic-paper-deep transition"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="px-4 py-2 rounded-lg bg-ic-accent text-white text-sm font-medium hover:opacity-90 transition"
        >
          Get started
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 text-ic-muted hover:text-ic-ink transition-colors"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-ic-card border-t border-ic-rule px-6 py-4 flex flex-col gap-1 z-50">
          <Link href="/ai-lab" onClick={() => setMenuOpen(false)}
            className="text-ic-muted hover:text-ic-ink text-sm py-2 transition-colors">
            AI Lab
          </Link>
          <Link href="/explore" onClick={() => setMenuOpen(false)}
            className="text-ic-muted hover:text-ic-ink text-sm py-2 transition-colors">
            Explore
          </Link>
          <Link href="/sign-in" onClick={() => setMenuOpen(false)}
            className="text-ic-muted hover:text-ic-ink text-sm py-2 transition-colors">
            Sign in
          </Link>
          <Link href="/sign-up" onClick={() => setMenuOpen(false)}
            className="text-ic-ink font-medium text-sm py-2 transition-colors">
            Get started →
          </Link>
        </div>
      )}
    </nav>
  );
}
