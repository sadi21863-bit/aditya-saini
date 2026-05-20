"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter }                   from "next/navigation";
import Link                            from "next/link";

const TIMEOUT_MS    = 15 * 60 * 1000;
const POLL_INTERVAL = 10_000;

// GHA dispatch starts in ~30-60s. After 90s it's running. After 3min something
// is slower than expected (cold start, queue backlog) but the cron will catch it.
const SLOW_THRESHOLD_MS   = 3 * 60 * 1000;
const STARTING_THRESHOLD_MS = 90_000;

interface Props {
  debateId:      string;
  currentStatus: string;
  createdAt:     Date | string;
}

export function DebatePoller({ debateId: _debateId, currentStatus, createdAt }: Props) {
  const router                  = useRouter();
  const [elapsed, setElapsed]   = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const startRef                = useRef<number>(new Date(createdAt).getTime());

  useEffect(() => {
    const initialElapsed = Date.now() - startRef.current;
    if (initialElapsed >= TIMEOUT_MS) { setTimedOut(true); return; }
    setElapsed(initialElapsed);

    const poll = setInterval(() => {
      const now = Date.now() - startRef.current;
      if (now >= TIMEOUT_MS) {
        setTimedOut(true);
        clearInterval(poll);
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_INTERVAL);

    const tick  = setInterval(() => setElapsed(Date.now() - startRef.current), 1_000);
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
            onClick={() => {
              setTimedOut(false);
              setElapsed(0);
              startRef.current = Date.now();
              router.refresh();
            }}
            className="px-4 py-2 rounded-lg border border-ic-rule text-sm text-ic-ink
                       hover:bg-ic-paper-deep transition"
          >
            Refresh
          </button>
          <Link
            href="/debates/new"
            className="px-4 py-2 rounded-lg text-sm text-ic-muted hover:text-ic-ink transition"
          >
            Try again →
          </Link>
        </div>
      </div>
    );
  }

  const secs = Math.floor(elapsed / 1000);

  function statusLine(): string {
    if (elapsed < STARTING_THRESHOLD_MS) return "Starting — usually takes 30–60 seconds";
    if (currentStatus === "in_progress")  return "Agents are debating…";
    return "Writing the archive…";
  }

  function subLine(): string | null {
    if (elapsed >= SLOW_THRESHOLD_MS) {
      return "Taking longer than expected — agents are queued and will respond shortly.";
    }
    return null;
  }

  const sub = subLine();

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-2 h-2 rounded-full bg-ic-accent-bright animate-pulse shrink-0" />
        <p className="font-mono text-sm text-ic-ink">{statusLine()}</p>
      </div>
      {sub && (
        <p className="font-mono text-[11px] text-ic-muted ml-5 mb-1">{sub}</p>
      )}
      <p className="font-mono text-[11px] text-ic-muted ml-5">
        {secs === 0 ? "Just started" : `${secs}s elapsed`} · refreshes every 10s
      </p>
    </div>
  );
}
