"use client";

import { useActionState } from "react";
import { submitQuickDebate } from "./actions";

const initialState = { error: "" };

export default function NewDebatePage() {
  const [state, formAction, isPending] = useActionState(submitQuickDebate, initialState);

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
          Two AI agents — Llama and GPT-OSS — debate it in real-time. You get a shareable archive.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <textarea
          name="ideaText"
          rows={5}
          minLength={20}
          maxLength={500}
          required
          placeholder="What's the idea? Be specific enough that there's something to argue about. (20–500 characters)"
          className="w-full rounded-lg border border-ic-rule bg-transparent p-4 text-ic-ink
                     placeholder:text-ic-muted resize-none focus:outline-none focus:ring-2
                     focus:ring-ic-accent font-display text-base leading-relaxed"
        />
        {state?.error && (
          <p className="text-red-500 text-sm font-mono">{state.error}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 rounded-lg bg-ic-accent text-white text-sm font-medium
                       hover:opacity-90 disabled:opacity-50 transition"
          >
            {isPending ? "Submitting…" : "Start debate →"}
          </button>
          <p className="font-mono text-[11px] text-ic-muted">
            Takes ~2 minutes · 10 debates/day limit
          </p>
        </div>
      </form>
    </main>
  );
}
