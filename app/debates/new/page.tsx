"use client";

import { useState }    from "react";
import { useRouter }   from "next/navigation";
import Link            from "next/link";

export default function NewDebatePage() {
  const router = useRouter();
  const [input,   setInput]   = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [waitingAnswer, setWaitingAnswer] = useState(false);
  const [question,      setQuestion]      = useState<string | null>(null);
  const [debateId,      setDebateId]      = useState<string | null>(null);
  const [answer,        setAnswer]        = useState("");

  async function handleSubmit() {
    if (input.trim().length < 10) { setError("Needs at least 10 characters."); return; }
    setLoading(true); setError(null);

    const res  = await fetch("/api/debates/judge", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ input }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }

    if (data.status === "needs_clarification") {
      setQuestion(data.question); setDebateId(data.debateId); setWaitingAnswer(true);
    } else if (data.status === "single_answer") {
      router.push(`/debates/${data.debateId}`);
    } else if (data.status === "full_debate") {
      await startDebate(data.debateId);
    }
  }

  async function handleAnswerSubmit() {
    if (!debateId || !answer.trim()) return;
    setLoading(true); setError(null);

    const res  = await fetch("/api/debates/judge", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ input, debateId, questionAnswer: answer }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }

    if (data.status === "single_answer") {
      router.push(`/debates/${data.debateId}`);
    } else if (data.status === "full_debate") {
      await startDebate(data.debateId);
    }
  }

  async function startDebate(id: string) {
    setLoading(true);
    const res = await fetch("/api/debates/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ debateId: id }),
    });
    setLoading(false);
    if (res.ok) router.push(`/debates/${id}`);
    else { const d = await res.json(); setError(d.error ?? "Failed to start debate."); }
  }

  if (waitingAnswer && question) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-4">
          One quick question
        </p>
        <p className="font-display text-xl text-ic-ink mb-6">{question}</p>
        <textarea
          rows={3}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Your answer…"
          className="w-full rounded-lg border border-ic-rule bg-transparent p-4 text-ic-ink
                     placeholder:text-ic-muted resize-none focus:outline-none focus:ring-2
                     focus:ring-ic-accent font-display text-base mb-4"
        />
        {error && <p className="text-red-500 text-sm font-mono mb-3">{error}</p>}
        <button
          onClick={handleAnswerSubmit}
          disabled={loading || !answer.trim()}
          className="px-6 py-3 rounded-lg bg-ic-accent text-white text-sm font-medium
                     hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? "Working…" : "Continue →"}
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
          Quick Debate
        </p>
        <h1 className="font-display text-4xl font-normal tracking-tight text-ic-ink mb-3">
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
          className="w-full rounded-lg border border-ic-rule bg-transparent p-4 text-ic-ink
                     placeholder:text-ic-muted resize-none focus:outline-none focus:ring-2
                     focus:ring-ic-accent font-display text-base leading-relaxed"
        />
        {error && <p className="text-red-500 text-sm font-mono">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || input.trim().length < 10}
            className="px-6 py-3 rounded-lg bg-ic-accent text-white text-sm font-medium
                       hover:opacity-90 disabled:opacity-50 transition"
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
