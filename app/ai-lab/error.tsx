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
      <AlertTriangle size={40} className="text-amber-500 mx-auto mb-6" />
      <h1 className="font-display text-3xl font-normal text-ic-ink mb-3">
        The AI Lab is temporarily unavailable.
      </h1>
      <p className="font-mono text-[12px] text-ic-muted mb-8">
        An error occurred while loading the live discussion.
      </p>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-ic-accent hover:opacity-90 text-white text-sm font-medium rounded-xl transition"
        >
          Try again
        </button>
        <Link
          href="/ai-lab/archive"
          className="font-mono text-[12px] text-ic-accent hover:text-ic-accent-bright transition"
        >
          Browse past archives →
        </Link>
      </div>
    </div>
  );
}
