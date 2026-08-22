import type { Metadata } from "next";
import { notFound }      from "next/navigation";
import Link              from "next/link";
import {
  getDebateByShareToken,
  getDebateParticipants,
  getDebateTurns,
} from "@/lib/agents/debate-helpers";
import { getAgent } from "@/lib/agents/personas";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token }  = await params;
  const debate = await getDebateByShareToken(token);
  if (!debate) return {};

  const topic      = debate.title.slice(0, 60);
  const participants = await getDebateParticipants(debate.id);
  const agentA     = getAgent(participants[0]?.agentId ?? "");
  const agentB     = getAgent(participants[1]?.agentId ?? "");
  const winnerText = debate.verdict ? ` ${debate.verdict.slice(0, 60)}.` : "";
  const description = `${agentA?.name ?? "Agent A"} vs ${agentB?.name ?? "Agent B"}.${winnerText} Read the full debate.`;
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return {
    title:       `AI Debate: ${topic}`,
    description,
    openGraph: {
      title:       `AI Debate: ${topic}`,
      description,
      url:         `${appUrl}/debates/share/${token}`,
      type:        "article",
      images: [
        `${appUrl}/api/og?title=${encodeURIComponent(topic)}&type=debate`,
      ],
    },
    robots: "index, follow",
  };
}

// Per-agent accent colors — pairs of [bg, text] Tailwind classes
const AGENT_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  "ai_llama":          { bg: "bg-ic-ai-llama-bg",    accent: "border-l-ic-ai-llama-accent",    label: "text-ic-ai-llama-fg"    },
  "ai_gpt_oss":        { bg: "bg-ic-ai-gptoss-bg",   accent: "border-l-ic-ai-gptoss-accent",   label: "text-ic-ai-gptoss-fg"   },
  "ai_scout":          { bg: "bg-ic-ai-scout-bg",    accent: "border-l-ic-ai-scout-accent",    label: "text-ic-ai-scout-fg"    },
  "ai_maverick":       { bg: "bg-ic-ai-maverick-bg", accent: "border-l-ic-ai-maverick-accent", label: "text-ic-ai-maverick-fg" },
  "ai_quality_checker":{ bg: "bg-ic-card",           accent: "border-l-ic-accent",             label: "text-ic-fg"             },
  "ai_archivist":      { bg: "bg-ic-card",           accent: "border-l-ic-accent",             label: "text-ic-fg"             },
};
const DEFAULT_COLORS = { bg: "bg-ic-card", accent: "border-l-ic-accent", label: "text-ic-fg" };

function agentColors(agentId: string) {
  return AGENT_COLORS[agentId] ?? DEFAULT_COLORS;
}

export default async function PublicSharePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const debate = await getDebateByShareToken(token);
  if (!debate || debate.status !== "archived") notFound();

  const participants = await getDebateParticipants(debate.id);
  const allTurns = (await getDebateTurns(debate.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const agentA = getAgent(participants[0]?.agentId ?? "");
  const agentB = getAgent(participants[1]?.agentId ?? "");
  const agentAId = participants[0]?.agentId ?? "";
  const agentBId = participants[1]?.agentId ?? "";
  const colorsA = agentColors(agentAId);
  const colorsB = agentColors(agentBId);

  const round1Turns = allTurns.filter(t => t.round === 1);
  const round2Turns = allTurns.filter(t => t.round === 2);

  const verdictExcerpt = debate.verdictReasoning
    ? debate.verdictReasoning.slice(0, 200) + (debate.verdictReasoning.length > 200 ? "…" : "")
    : null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 sm:px-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#FB923C] mb-3">
        AI Debate · IdeaConnect
      </p>
      <h1 className="font-display text-[clamp(28px,4vw,38px)] font-normal tracking-tight text-ic-ink leading-snug mb-10">
        {debate.title}
      </h1>

      {/* ── Agent cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          { agent: agentA, agentId: agentAId, colors: colorsA, label: "Agent A" },
          { agent: agentB, agentId: agentBId, colors: colorsB, label: "Agent B" },
        ].map(({ agent, colors, label }) => (
          <div
            key={label}
            className={`rounded-xl p-4 border border-ic-rule/30 border-l-4 ${colors.bg} ${colors.accent}`}
          >
            <p className={`font-mono text-[11px] uppercase tracking-widest mb-1 ${colors.label}`}>
              {label}
            </p>
            <p className={`font-semibold text-sm ${colors.label}`}>
              {agent?.name ?? label}
            </p>
            {agent?.handle && (
              <p className="font-mono text-[10px] text-ic-muted mt-0.5">@{agent.handle}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Round 1 turns ────────────────────────────────────────────── */}
      {round1Turns.length > 0 && (
        <div className="space-y-4 mb-8">
          {round1Turns.map(turn => {
            const isA   = turn.agentId === agentAId;
            const col   = isA ? colorsA : colorsB;
            const agent = isA ? agentA : agentB;
            const label = isA ? "Agent A" : "Agent B";
            return (
              <div key={turn.id} className={`rounded-xl p-5 border border-ic-rule/30 border-l-4 ${col.bg} ${col.accent}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-mono text-[11px] font-semibold ${col.label}`}>
                    {agent?.name ?? label}
                  </span>
                  {turn.round > 1 && (
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-ic-rule/50 text-ic-muted">
                      Round {turn.round}
                    </span>
                  )}
                </div>
                <p className="text-ic-ink text-sm leading-relaxed">{turn.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Round 2 turns ────────────────────────────────────────────── */}
      {round2Turns.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-ic-rule/30" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-ic-muted">Round 2</span>
            <div className="flex-1 h-px bg-ic-rule/30" />
          </div>
          <div className="space-y-4 mb-8">
            {round2Turns.map(turn => {
              const isA   = turn.agentId === agentAId;
              const col   = isA ? colorsA : colorsB;
              const agent = isA ? agentA : agentB;
              const label = isA ? "Agent A" : "Agent B";
              return (
                <div key={turn.id} className={`rounded-xl p-5 border border-ic-rule/30 border-l-4 ${col.bg} ${col.accent}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-mono text-[11px] font-semibold ${col.label}`}>
                      {agent?.name ?? label}
                    </span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-ic-rule/50 text-ic-muted">
                      Round {turn.round}
                    </span>
                  </div>
                  <p className="text-ic-ink text-sm leading-relaxed">{turn.content}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Verdict banner ───────────────────────────────────────────── */}
      {debate.verdict && (
        <div className="rounded-xl border-2 border-[#F97316]/20 bg-[#F97316]/5 p-5 mb-10">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#F97316] mb-2">
            Verdict
          </p>
          <p className="font-display text-base font-semibold text-ic-ink mb-2">
            {debate.verdict}
          </p>
          {verdictExcerpt && (
            <p className="text-sm text-ic-muted leading-relaxed">{verdictExcerpt}</p>
          )}
        </div>
      )}

      {/* Round 1 archive summary (no Round 2) */}
      {debate.archivistSummary && !debate.verdict && (
        <div className="rounded-xl bg-ic-card/50 p-5 mb-10">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ic-muted mb-3">
            Archive
          </p>
          <p className="text-sm text-ic-ink leading-relaxed">{debate.archivistSummary}</p>
        </div>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <div className="pt-6 border-t border-ic-rule/30">
        <p className="text-sm text-ic-muted mb-3">Debate your own idea →</p>
        <Link
          href="/debates/new"
          className="inline-block px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm
                     font-medium hover:bg-[#EA580C] transition-colors"
        >
          Start a debate
        </Link>
      </div>

    </main>
  );
}
