"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RequestVerdictButton({ debateId }: { debateId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  async function requestVerdict() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/debates/${debateId}/verdict`, {
        method: "POST",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to request verdict."
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mb-8">
      <p className="font-mono text-[11px] text-ic-muted mb-3">
        Maximum rounds reached. The agents have made their case.
      </p>
      <button
        onClick={requestVerdict}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-ic-rule text-sm text-ic-ink
                   hover:bg-ic-paper-deep transition font-mono disabled:opacity-50"
      >
        {loading ? "Generating verdict…" : "Get final verdict →"}
      </button>
      {error && (
        <p className="mt-2 font-mono text-[11px] text-ic-danger">{error}</p>
      )}
    </div>
  );
}
