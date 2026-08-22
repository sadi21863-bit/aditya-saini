"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  debateId: string;
  roundCount: number;
  maxPushbacks: number;
  pushbacksUsed: number;
  disabled?: boolean;
}

export function PushbackInput({
  debateId,
  roundCount,
  maxPushbacks,
  pushbacksUsed,
  disabled,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const remaining = maxPushbacks - pushbacksUsed;
  const canPushback = remaining > 0 && !disabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !canPushback) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/debates/pushback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId, text: text.trim() }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to submit pushback."
        );
      }
      setSubmitted(true);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-ic-card/50 rounded-2xl p-5 mb-8">
        <p className="font-mono text-sm text-ic-ink">
          Pushback submitted — agents are responding…
        </p>
      </div>
    );
  }

  return (
    <div className="bg-ic-card/50 rounded-2xl p-5 mb-8">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
        Push back — Round {roundCount + 1}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Challenge the agents' reasoning, point out a gap, or redirect the debate…"
          rows={3}
          maxLength={1000}
          disabled={!canPushback || loading}
          className="w-full rounded-xl border border-ic-rule/30 bg-ic-card/50 px-4 py-3
                     font-display text-sm text-ic-ink placeholder:text-ic-muted
                     focus:outline-none focus:border-[#F97316]/50 focus:ring-2 focus:ring-[#F97316]/20 transition resize-none
                     disabled:opacity-50"
        />

        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] text-ic-muted">
            {text.length}/1000 · {remaining} pushback{remaining !== 1 ? "s" : ""} remaining
          </p>

          <button
            type="submit"
            disabled={!canPushback || loading || text.trim().length < 10}
            className="px-4 py-2 rounded-xl bg-[#F97316] text-white text-sm
                       hover:bg-[#EA580C] transition font-mono disabled:opacity-50
                       disabled:cursor-not-allowed"
          >
            {loading ? "Submitting…" : "Push back →"}
          </button>
        </div>

        {error && (
          <p className="font-mono text-[11px] text-ic-danger">{error}</p>
        )}
      </form>
    </div>
  );
}
