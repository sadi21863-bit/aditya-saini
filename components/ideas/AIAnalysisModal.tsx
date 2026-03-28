"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Zap,
  Eye,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIAnalysisResult } from "@/lib/ai";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AnalysisStatus = "idle" | "processing" | "queued" | "done" | "failed";

interface AIAnalysisModalProps {
  ideaId: string;
  isOwner: boolean;
  initialStatus: AnalysisStatus | null;
  initialSummary: string | null;     // raw JSON string from DB, or null
  initialPosition?: number | null;
  initialEstimatedAt?: string | null; // ISO string
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Score bar
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Icon className="w-3.5 h-3.5 text-teal-400" />
          {label}
        </div>
        <span className="text-sm font-bold text-white">{value}/100</span>
      </div>
      <div className="h-2 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-1000 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Countdown timer bar
// ─────────────────────────────────────────────────────────────────────────────

function CountdownBar({ estimatedAt }: { estimatedAt: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);

  useEffect(() => {
    if (!estimatedAt) return;
    const target = new Date(estimatedAt).getTime();
    const initial = Math.max(0, Math.round((target - Date.now()) / 1000));
    setTotalSeconds(initial);
    setSecondsLeft(initial);

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((target - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [estimatedAt]);

  const progress =
    totalSeconds > 0 ? Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100) : 0;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Estimated wait</span>
        <span className="font-mono font-bold text-teal-400">
          {minutes > 0 ? `~${minutes}m ` : ""}{seconds}s
        </span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-700 to-teal-400 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated progress bar for "processing" state
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedProgressBar() {
  return (
    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-teal-700 via-teal-400 to-teal-700 animate-[shimmer_2s_linear_infinite]"
        style={{
          backgroundSize: "200% 100%",
          animation: "shimmer 2s linear infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function AIAnalysisModal({
  ideaId,
  isOwner,
  initialStatus,
  initialSummary,
  initialPosition = null,
  initialEstimatedAt = null,
}: AIAnalysisModalProps) {
  const resolvedInitialStatus: AnalysisStatus =
    initialStatus === "done" && initialSummary
      ? "done"
      : initialStatus === "queued"
      ? "queued"
      : initialStatus === "processing"
      ? "processing"
      : initialStatus === "failed"
      ? "failed"
      : "idle";

  const [status, setStatus] = useState<AnalysisStatus>(resolvedInitialStatus);
  const [result, setResult] = useState<AIAnalysisResult | null>(() => {
    if (initialSummary && initialStatus === "done") {
      try {
        return JSON.parse(initialSummary) as AIAnalysisResult;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [position, setPosition] = useState<number | null>(initialPosition);
  const [estimatedAt, setEstimatedAt] = useState<string | null>(initialEstimatedAt);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [requesting, setRequesting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll when queued ────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          idea: {
            aiStatus: string | null;
            aiSummary: string | null;
          };
        };
        const { aiStatus, aiSummary } = data.idea;

        if (aiStatus === "done" && aiSummary) {
          try {
            const parsed = JSON.parse(aiSummary) as AIAnalysisResult;
            setResult(parsed);
            setStatus("done");
          } catch {
            setStatus("failed");
            setErrorMessage("Result data was corrupt.");
          }
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (aiStatus === "failed") {
          setStatus("failed");
          setErrorMessage("Analysis failed during processing.");
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Network error — keep polling silently
      }
    }, 10_000); // every 10 seconds
  }, [ideaId]);

  useEffect(() => {
    if (status === "queued") {
      startPolling();
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, startPolling]);

  // ── Request analysis ────────────────────────────────────────────────────────
  async function handleRequest() {
    setRequesting(true);
    setStatus("processing");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/ideas/${ideaId}/analyze`, {
        method: "POST",
      });

      const data = (await res.json()) as {
        status: string;
        cached?: boolean;
        result?: AIAnalysisResult;
        position?: number;
        estimatedAt?: string;
        message?: string;
      };

      if (data.status === "done" && data.result) {
        setResult(data.result);
        setStatus("done");
      } else if (data.status === "queued") {
        setPosition(data.position ?? null);
        setEstimatedAt(data.estimatedAt ?? null);
        setStatus("queued");
        startPolling();
      } else if (data.status === "processing") {
        setStatus("processing");
        // Will poll
        startPolling();
      } else {
        setStatus("failed");
        setErrorMessage(data.message ?? "Unknown error occurred.");
      }
    } catch {
      setStatus("failed");
      setErrorMessage("Network error. Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  async function handleRetry() {
    setStatus("idle");
    setErrorMessage("");
    setResult(null);
  }

  // ── Only show to owner (non-owners see nothing) ─────────────────────────────
  if (!isOwner && status !== "done") {
    return null;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">

      {/* ── STATE: IDLE ──────────────────────────────────────────────────────── */}
      {status === "idle" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-teal-400" />
            </div>
            <h3 className="text-base font-bold text-white">AI Idea Analysis</h3>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            Get an AI-powered breakdown of your idea's feasibility, clarity,
            and market potential — powered by Llama 3.1 via Groq.
          </p>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/8 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300 leading-relaxed">
              The AI will read your idea's title, description, and tags to
              generate this analysis. This action cannot be undone, and the
              result will be cached permanently.
            </p>
          </div>

          <button
            onClick={handleRequest}
            disabled={requesting}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl",
              "bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold",
              "shadow-lg shadow-teal-900/30 transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {requesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting analysis…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Approve &amp; Generate Summary
              </>
            )}
          </button>
        </div>
      )}

      {/* ── STATE: PROCESSING ────────────────────────────────────────────────── */}
      {status === "processing" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-white">
              Generating your analysis…
            </h3>
          </div>

          <AnimatedProgressBar />

          <p className="text-xs text-slate-500">
            This usually takes a few seconds. Please don't close this page.
          </p>
        </div>
      )}

      {/* ── STATE: QUEUED ────────────────────────────────────────────────────── */}
      {status === "queued" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-400" />
            </div>
            <h3 className="text-base font-bold text-white">
              You're in the queue
            </h3>
          </div>

          {position !== null && (
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center rounded-lg border border-white/10 bg-white/4 p-3">
                <p className="text-xs text-slate-500 mb-0.5">Your position</p>
                <p className="text-2xl font-extrabold text-orange-400">
                  #{position}
                </p>
              </div>
            </div>
          )}

          <CountdownBar estimatedAt={estimatedAt} />

          <div className="rounded-lg bg-white/3 border border-white/8 p-3 text-xs text-slate-400 leading-relaxed">
            <p>
              Due to high demand, AI requests are being processed in order.
              Your result will appear here automatically — no need to refresh.
            </p>
          </div>
        </div>
      )}

      {/* ── STATE: DONE ──────────────────────────────────────────────────────── */}
      {status === "done" && result && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-white">AI Analysis</h3>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
              <Zap className="w-3 h-3 text-teal-400" />
              <span className="text-xs font-bold text-teal-400">
                Score: {result.score}/100
              </span>
            </div>
          </div>

          {/* Score bars */}
          <div className="space-y-4">
            <ScoreBar
              label="Feasibility"
              value={result.feasibility}
              icon={CheckCircle}
            />
            <ScoreBar
              label="Clarity"
              value={result.clarity}
              icon={Eye}
            />
            <ScoreBar
              label="Market Potential"
              value={result.marketPotential}
              icon={TrendingUp}
            />
          </div>

          {/* Overall score */}
          <div className="rounded-lg border border-teal-500/20 bg-teal-950/30 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
              Overall Score
            </span>
            <span className="text-xl font-extrabold text-white">
              {result.score}
              <span className="text-slate-500 text-sm font-normal">/100</span>
            </span>
          </div>

          {/* Summary */}
          <div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">
              Summary
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {result.summary}
            </p>
          </div>
        </div>
      )}

      {/* ── STATE: FAILED ────────────────────────────────────────────────────── */}
      {status === "failed" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <h3 className="text-base font-bold text-white">
              Analysis could not be completed
            </h3>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}

          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-sm font-semibold hover:bg-white/10 hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
