"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  queued:    "Waiting in queue…",
  seeding:   "Llama is thinking…",
  debating:  "GPT-OSS is responding…",
  archiving: "Writing the archive…",
};

const TIMEOUT_MS     = 10 * 60 * 1000;  // 10 minutes
const POLL_INTERVAL  = 10_000;           // 10 seconds

interface Props {
  debateId:      string;
  currentStatus: string;
  createdAt:     Date | string;
}

export default function DebatePoller({ debateId, currentStatus, createdAt }: Props) {
  const router        = useRouter();
  const [secs, setSecs]     = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const startRef = useRef<number>(new Date(createdAt).getTime());

  useEffect(() => {
    const elapsed = Date.now() - startRef.current;
    if (elapsed >= TIMEOUT_MS) {
      setTimedOut(true);
      return;
    }

    const poll = setInterval(() => {
      const now = Date.now() - startRef.current;
      if (now >= TIMEOUT_MS) {
        setTimedOut(true);
        clearInterval(poll);
        return;
      }
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, POLL_INTERVAL);

    const tick = setInterval(() => setSecs((s) => s + 1), 1_000);

    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  if (timedOut) {
    return (
      <div className="mt-10">
        <p className="text-ic-ink-soft mb-3">
          This debate is taking longer than expected. The agents may still be running — try refreshing.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setTimedOut(false); setSecs(0); startRef.current = Date.now(); router.refresh(); }}
            className="px-4 py-2 rounded-lg border border-ic-rule text-sm text-ic-ink hover:bg-ic-paper-deep transition"
          >
            Refresh
          </button>
          <Link
            href="/debate/new"
            className="px-4 py-2 rounded-lg text-sm text-ic-muted hover:text-ic-ink transition"
          >
            Try again →
          </Link>
        </div>
      </div>
    );
  }

  const label = STATUS_LABEL[currentStatus] ?? "Processing…";

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-2 h-2 rounded-full bg-ic-accent-bright animate-pulse" />
        <p className="font-mono text-sm text-ic-ink">{label}</p>
      </div>
      <p className="font-mono text-[11px] text-ic-muted">
        Updated {secs === 0 ? "just now" : `${secs}s ago`} · refreshes every 10s
      </p>
    </div>
  );
}
