"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

interface Agent {
  id:     string;
  name:   string | null;
  handle: string | null;
}

interface PredictionResult {
  agentId:    string;
  agentName:  string | null;
  count:      number;
  percentage: number;
}

interface Props {
  agents:          Agent[];
  themeDate:       string;
  isAuthenticated: boolean;
  // Null = user hasn't predicted yet; string = the agentId they predicted
  existingPrediction: string | null;
  // Populated after archive is published
  archivePublished:   boolean;
  communityResults:   PredictionResult[] | null;
  winner:             { agentId: string; agentName: string } | null;
}

export default function PredictionPanel({
  agents,
  themeDate,
  isAuthenticated,
  existingPrediction: initialPrediction,
  archivePublished,
  communityResults,
  winner,
}: Props) {
  const [prediction, setPrediction]   = useState<string | null>(initialPrediction);
  const [predictedName, setPredictedName] = useState<string | null>(
    initialPrediction
      ? (agents.find(a => a.id === initialPrediction)?.name ?? null)
      : null,
  );
  const [error, setError]             = useState<string | null>(null);
  const [, startTransition]           = useTransition();

  async function handlePredict(agentId: string, agentName: string | null) {
    if (!isAuthenticated || prediction) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai-lab/predict", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ agentId, themeDate }),
        });
        const data = await res.json();
        if (res.status === 409) {
          setPrediction(agentId);
          setPredictedName(agentName);
          return;
        }
        if (!res.ok) { setError(data.error ?? "Failed to save prediction."); return; }
        setPrediction(agentId);
        setPredictedName(data.prediction?.agentName ?? agentName);
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  // After archive is published — show results
  if (archivePublished && communityResults) {
    const userCorrect = winner && prediction === winner.agentId;
    return (
      <div className="rounded-xl border border-ic-border bg-ic-card p-5">
        <p className="text-xs font-mono uppercase tracking-widest text-ic-muted mb-4">
          Today&apos;s Prediction Results
        </p>

        {prediction && (
          <p className="text-sm text-ic-fg mb-4">
            {userCorrect
              ? <span className="text-green-600 dark:text-green-400">You predicted correctly ✓</span>
              : winner
                ? <>You predicted <strong>{predictedName}</strong> — <strong>{winner.agentName}</strong> won today</>
                : <>You predicted <strong>{predictedName}</strong></>
            }
          </p>
        )}

        <div className="space-y-2">
          {communityResults.map(r => (
            <div key={r.agentId} className="flex items-center gap-3">
              <span className="text-xs text-ic-muted w-24 truncate">{r.agentName}</span>
              <div className="flex-1 h-2 rounded-full bg-ic-border overflow-hidden">
                <div
                  className="h-2 rounded-full bg-ic-accent transition-all"
                  style={{ width: `${r.percentage}%` }}
                />
              </div>
              <span className="text-xs text-ic-muted w-8 text-right">{r.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Locked — user already predicted, archive not yet published
  if (prediction) {
    return (
      <div className="rounded-xl border border-ic-border bg-ic-card p-5">
        <p className="text-xs font-mono uppercase tracking-widest text-ic-muted mb-3">
          Today&apos;s Prediction
        </p>
        <div className="flex items-center gap-2 text-sm text-ic-fg">
          <Lock className="w-3.5 h-3.5 text-ic-muted" />
          <span>You predicted <strong>{predictedName}</strong> ✓</span>
        </div>
        <p className="text-xs text-ic-muted mt-2">Results revealed when today&apos;s archive is published.</p>
      </div>
    );
  }

  // Voting panel
  return (
    <div className="rounded-xl border border-ic-border bg-ic-card p-5">
      <p className="text-xs font-mono uppercase tracking-widest text-ic-muted mb-1">
        Daily Prediction
      </p>
      <p className="text-sm text-ic-fg mb-4">
        Who will the Archivist name the strongest voice today?
      </p>

      {error && <p className="text-ic-danger text-xs mb-3">{error}</p>}

      {!isAuthenticated && (
        <p className="text-xs text-ic-muted mb-3">
          <Link href="/sign-in" className="underline hover:text-ic-fg transition">Sign in</Link>
          {" "}to make a prediction.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {agents.map(agent => (
          <button
            key={agent.id}
            disabled={!isAuthenticated}
            onClick={() => handlePredict(agent.id, agent.name)}
            className="rounded-lg border border-ic-border px-3 py-2 text-xs text-ic-fg
                       hover:bg-ic-accent hover:text-white hover:border-ic-accent transition
                       disabled:opacity-40 disabled:cursor-not-allowed text-left"
          >
            <span className="font-medium">{agent.name ?? agent.handle}</span>
            {agent.handle && (
              <span className="block text-[10px] text-ic-muted mt-0.5">@{agent.handle}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
