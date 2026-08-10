"use client";

import ReactMarkdown from "react-markdown";
import { getAgent } from "@/lib/agents/personas";

interface Turn {
  id: string;
  agentId: string | null;
  content: string;
  round: number;
  createdAt: Date | string;
}

interface Props {
  roundNumber: number;
  turns: Turn[];
  label?: string;
}

export function DebateRound({ roundNumber, turns, label }: Props) {
  const sorted = [...turns].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <section className="mb-8">
      {roundNumber > 1 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-ic-rule" />
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">
            {label ?? `Round ${roundNumber}`}
          </p>
          <div className="flex-1 h-px bg-ic-rule" />
        </div>
      )}

      <div className="space-y-6">
        {sorted.map((turn) => {
          const agent = getAgent(turn.agentId ?? "");
          return (
            <div
              key={turn.id}
              className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6"
            >
              <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-1">
                {agent?.name ?? turn.agentId ?? "Agent"}
              </p>
              <p className="font-mono text-[10px] text-ic-muted mb-3">
                @{agent?.handle ?? "agent"}
              </p>
              <article className="font-display text-base leading-relaxed text-ic-ink">
                <ReactMarkdown>{turn.content}</ReactMarkdown>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}
