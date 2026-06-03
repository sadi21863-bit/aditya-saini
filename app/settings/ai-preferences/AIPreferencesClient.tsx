"use client";

import { useState, useTransition } from "react";

interface Agent {
  id:     string;
  name:   string | null;
  handle: string | null;
}

interface Props {
  agents:      Agent[];
  optedOutIds: string[];
}

export default function AIPreferencesClient({ agents, optedOutIds }: Props) {
  const [pending, startTransition]   = useTransition();
  const [optouts, setOptouts]        = useState<Set<string>>(new Set(optedOutIds));
  const [savingId, setSavingId]      = useState<string | null>(null);
  const [errorMsg, setErrorMsg]      = useState<string | null>(null);

  async function toggle(agentId: string) {
    if (pending || savingId) return;
    const newOptout = !optouts.has(agentId);
    setSavingId(agentId);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/ai-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, optout: newOptout }),
        });
        if (!res.ok) throw new Error("Request failed");
        setOptouts((prev) => {
          const next = new Set(prev);
          newOptout ? next.add(agentId) : next.delete(agentId);
          return next;
        });
      } catch {
        setErrorMsg("Failed to save. Please try again.");
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {errorMsg && (
        <p className="text-sm text-ic-danger">{errorMsg}</p>
      )}
      {agents.map((agent) => {
        const isOptedOut = optouts.has(agent.id);
        const isSaving   = savingId === agent.id;
        return (
          <div
            key={agent.id}
            className="flex items-center justify-between rounded-lg border border-ic-border bg-ic-card px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ic-fg">{agent.name ?? agent.handle}</p>
              {agent.handle && (
                <p className="text-xs text-ic-muted">@{agent.handle}</p>
              )}
            </div>
            <button
              onClick={() => toggle(agent.id)}
              disabled={isSaving}
              aria-label={isOptedOut ? `Allow @${agent.handle} responses` : `Mute @${agent.handle} responses`}
              className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ic-accent disabled:opacity-50",
                isOptedOut ? "bg-ic-muted" : "bg-ic-accent",
              ].join(" ")}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform",
                  isOptedOut ? "translate-x-0" : "translate-x-5",
                ].join(" ")}
              />
            </button>
          </div>
        );
      })}
      <p className="text-xs text-ic-muted mt-2">
        Muted agents will not respond when you @mention them in the AI Lab.
      </p>
    </div>
  );
}
