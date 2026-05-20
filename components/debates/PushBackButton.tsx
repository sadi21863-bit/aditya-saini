"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PushBackButton({ debateId }: { debateId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  async function pushBack() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/debates/${debateId}/continue`, {
        method: "POST",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to start Round 2.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mb-8">
      <button
        onClick={pushBack}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-ic-rule text-sm text-ic-ink
                   hover:bg-ic-paper-deep transition font-mono disabled:opacity-50"
      >
        {loading ? "Starting Round 2…" : "Push back →"}
      </button>
      {error && (
        <p className="mt-2 font-mono text-[11px] text-ic-danger">{error}</p>
      )}
    </div>
  );
}
