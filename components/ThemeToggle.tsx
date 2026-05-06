"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center gap-2 rounded-lg text-slate-400 dark:text-slate-400
        hover:text-gray-900 dark:hover:text-white
        hover:bg-gray-100 dark:hover:bg-slate-800 transition
        ${collapsed ? "p-2 justify-center" : "px-3 py-2 w-full"}`}
    >
      {isDark
        ? <Sun  className={`shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`} />
        : <Moon className={`shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`} />}
      {!collapsed && (
        <span className="text-sm font-medium">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
