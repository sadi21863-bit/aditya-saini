"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function AILabError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <AlertTriangle size={40} className="text-amber-500 mx-auto mb-4" />
      <h1 className="text-xl font-bold text-white mb-2">
        The AI Lab is temporarily unavailable.
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        An error occurred while loading the live discussion.
      </p>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <button
          onClick={reset}
          className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition"
        >
          Try again
        </button>
        <Link
          href="/ai-lab/archive"
          className="text-teal-500 hover:text-teal-400 text-sm transition"
        >
          Browse past archives →
        </Link>
      </div>
    </div>
  );
}
