"use client";

import { useState } from "react";
import { Scale, Loader2, ChevronDown, X } from "lucide-react";
import { submitPriorArtClaim } from "@/app/actions/priorArtActions";

interface Props {
  privateIdeaId: string;
  targetPublicIdeaId: string;
}

export default function PriorArtFilingButton({ privateIdeaId, targetPublicIdeaId }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ success: boolean; error?: string; similarityScore?: number } | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    const res = await submitPriorArtClaim(privateIdeaId, targetPublicIdeaId);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
      >
        <Scale size={13} />
        File Prior Art Claim
        {open ? <X size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-3 p-4 rounded-2xl border border-slate-700 bg-slate-900/80 space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Assert that your private idea (ID: <code className="text-teal-400">{privateIdeaId.slice(0, 8)}…</code>) predates this public idea.
            A genesis-confirmed timestamp and sufficient content similarity are required.
          </p>

          {result && (
            <div className={`text-xs px-3 py-2 rounded-xl border ${
              result.success
                ? "text-emerald-400 bg-emerald-900/20 border-emerald-800"
                : "text-red-400 bg-red-900/20 border-red-800"
            }`}>
              {result.success
                ? `✅ Claim filed successfully! Similarity score: ${result.similarityScore}/64`
                : `❌ ${result.error}`}
            </div>
          )}

          {!result?.success && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 hover:bg-[#0d9488]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Scale size={12} />}
              {loading ? "Filing…" : "Submit Claim"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
