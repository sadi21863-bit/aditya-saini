"use client";

import { useState }    from "react";
import { useRouter }   from "next/navigation";
import Link            from "next/link";

export default function NewDebatePage() {
  const router = useRouter();
  const [input,     setInput]     = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{ message: string; resetAt?: string } | null>(null);
  const [loading,   setLoading]   = useState(false);

  const [waitingAnswer, setWaitingAnswer] = useState(false);
  const [question,      setQuestion]      = useState<string | null>(null);
  const [debateId,      setDebateId]      = useState<string | null>(null);
  const [answer,        setAnswer]        = useState("");

  async function handleSubmit() {
    if (input.trim().length < 10) { setError("Needs at least 10 characters."); return; }
    setLoading(true); setError(null); setRateLimit(null);

    try {
      const res  = await fetch("/api/debates/judge", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ input }),
        signal:  AbortSignal.timeout(15_000),
      });

      let data: Record<string, unknown>;
      try { data = await res.json(); }
      catch { throw new Error("The judge took too long. Try again."); }

      if (res.status === 429) {
        setRateLimit({ message: data.error as string, resetAt: data.resetAt as string | undefined });
        return;
      }
      if (!res.ok) throw new Error((data.error as string) ?? "Something went wrong.");

      if (data.status === "needs_clarification") {
        setQuestion(data.question as string);
        setDebateId(data.debateId as string);
        setWaitingAnswer(true);
      } else if (data.status === "single_answer") {
        router.push(`/debates/${data.debateId}`);
      } else if (data.status === "full_debate") {
        await startDebate(data.debateId as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswerSubmit() {
    if (!debateId || !answer.trim()) return;
    setLoading(true); setError(null);

    try {
      const res  = await fetch("/api/debates/judge", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ input, debateId, questionAnswer: answer, questionText: question }),
        signal:  AbortSignal.timeout(15_000),
      });

      let data: Record<string, unknown>;
      try { data = await res.json(); }
      catch { throw new Error("The judge took too long. Try again."); }

      if (!res.ok) throw new Error((data.error as string) ?? "Something went wrong.");

      if (data.status === "single_answer") {
        router.push(`/debates/${data.debateId}`);
      } else if (data.status === "full_debate") {
        await startDebate(data.debateId as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startDebate(id: string) {
    try {
      const res = await fetch("/api/debates/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ debateId: id }),
        signal:  AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        router.push(`/debates/${id}`);
      } else {
        const d = await res.json().catch(() => ({}));
        throw new Error((d.error as string) ?? "Failed to start debate.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start debate.");
    }
  }

  if (waitingAnswer && question) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#FB923C] mb-4">
          One quick question
        </p>
        <p className="font-display text-xl text-ic-ink mb-6">{question}</p>
        <textarea
          rows={3}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Your answer…"
          className="w-full rounded-xl border border-ic-rule/30 bg-ic-card/50 p-4 text-ic-ink
                     placeholder:text-ic-muted resize-none focus:outline-none focus:ring-2
                     focus:ring-[#FB923C]/30 focus:border-[#FB923C]/50 font-display text-base mb-4 transition-colors"
        />
        {error && <p className="text-ic-danger text-sm font-mono mb-3">{error}</p>}
        <button
          onClick={handleAnswerSubmit}
          disabled={loading || !answer.trim()}
          className="px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm font-medium
                     hover:bg-[#EA580C] disabled:opacity-50 transition-colors"
        >
          {loading ? "Working…" : "Continue →"}
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#FB923C] mb-3">
          Quick Debate
        </p>
        <h1 className="font-display text-[clamp(32px,5vw,48px)] font-normal tracking-tight text-ic-ink mb-3">
          Submit your idea
        </h1>
        <p className="text-ic-ink-soft text-base leading-relaxed max-w-lg">
          The Judge decides: direct answer or full AI debate. You get a shareable archive either way.
        </p>
      </div>
      <div className="space-y-4">
        <textarea
          rows={5}
          value={input}
          onChange={e => setInput(e.target.value)}
          minLength={10}
          maxLength={2000}
          placeholder="What's the idea or question? (10–2000 characters)"
          className="w-full rounded-xl border border-ic-rule/30 bg-ic-card/50 p-4 text-ic-ink
                     placeholder:text-ic-muted resize-none focus:outline-none focus:ring-2
                     focus:ring-[#FB923C]/30 focus:border-[#FB923C]/50 font-display text-base leading-relaxed transition-colors"
        />
        {error && (
          <p className="text-ic-danger text-sm font-mono">{error}</p>
        )}
        {rateLimit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">{rateLimit.message}</p>
            {rateLimit.resetAt && (
              <p className="mt-1 text-xs opacity-75">
                Resets at {new Date(rateLimit.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || input.trim().length < 10}
            className="px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm font-medium
                       hover:bg-[#EA580C] disabled:opacity-50 transition-colors"
          >
            {loading ? "Judging…" : "Submit →"}
          </button>
          <p className="font-mono text-[11px] text-ic-muted">
            5 debates · 10 judge calls per day
          </p>
        </div>
        <Link
          href="/debates/history"
          className="inline-block font-mono text-[11px] text-ic-muted hover:text-ic-ink transition"
        >
          View debate history →
        </Link>
      </div>
    </main>
  );
}
