"use client";

import ReactMarkdown from "react-markdown";
import { getAgent } from "@/lib/agents/personas";

interface Props {
  verdict: string;
  reasoning: string | null;
  winnerId: string | null;
  roundCount: number;
}

export function VerdictCard({ verdict, reasoning, winnerId, roundCount }: Props) {
  const winnerAgent = winnerId ? getAgent(winnerId) : null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-ic-rule" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">
          Verdict · {roundCount} round{roundCount !== 1 ? "s" : ""}
        </p>
        <div className="flex-1 h-px bg-ic-rule" />
      </div>

      <div className="border-l-2 border-ic-accent pl-5 mb-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">
          Winner
        </p>
        <p className="font-display text-base font-medium text-ic-ink">
          {winnerAgent?.name ?? "Draw"}
        </p>
      </div>

      <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6 mb-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
          Summary
        </p>
        <article className="font-display text-base leading-relaxed text-ic-ink">
          <ReactMarkdown>{verdict}</ReactMarkdown>
        </article>
      </div>

      {reasoning && (
        <div className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
            Reasoning
          </p>
          <article className="font-display text-base leading-relaxed text-ic-ink">
            <ReactMarkdown>{reasoning}</ReactMarkdown>
          </article>
        </div>
      )}
    </section>
  );
}
