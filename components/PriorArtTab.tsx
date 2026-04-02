"use client";

import { useState, useEffect } from "react";
import { Scale, Fingerprint, Loader2 } from "lucide-react";
import { getPriorArtClaims, type PriorArtClaimWithClaimant } from "@/app/actions/priorArtActions";

export default function PriorArtTab({ ideaId }: { ideaId: string }) {
  const [claims, setClaims] = useState<PriorArtClaimWithClaimant[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPriorArtClaims(ideaId).then((data) => {
      setClaims(data);
      setLoading(false);
    });
  }, [ideaId]);

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading claims…
      </div>
    );
  }

  if (!claims || claims.length === 0) {
    return (
      <div className="py-12 text-center">
        <Scale size={32} className="text-slate-700 mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">No prior art claims filed against this idea.</p>
        <p className="text-slate-600 text-xs mt-1">
          Prior art claims require a genesis-verified private idea that predates this one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <p className="text-xs text-slate-500 pb-2 border-b border-slate-800">
        {claims.length} prior art claim{claims.length !== 1 ? "s" : ""} filed against this idea.
      </p>

      {claims.map((claim) => {
        const similarityPct =
          claim.similarityScore !== null
            ? Math.round(((64 - claim.similarityScore) / 64) * 100)
            : null;

        const conceptionDate = claim.genesisTimestamp
          ? new Date(claim.genesisTimestamp).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })
          : "Unknown";

        const statusStyle =
          claim.status === "reviewed"
            ? "text-emerald-400 border-emerald-800 bg-emerald-900/20"
            : claim.status === "dismissed"
            ? "text-slate-500 border-slate-700 bg-slate-800/40"
            : "text-amber-400 border-amber-800 bg-amber-900/20";

        return (
          <div key={claim.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  @{claim.claimantHandle ?? "unknown"}
                </span>
                {claim.claimantTier && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-800 uppercase tracking-wider">
                    {claim.claimantTier}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusStyle}`}>
                {claim.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Fingerprint size={11} className="text-emerald-400" />
                Conceived {conceptionDate}
              </span>
              {similarityPct !== null && (
                <span className="flex items-center gap-1">
                  <Scale size={11} className="text-teal-400" />
                  {similarityPct}% content similarity
                </span>
              )}
            </div>

            {claim.adminNote && (
              <p className="text-xs text-slate-500 italic border-t border-slate-800 pt-2 mt-1">
                Admin note: {claim.adminNote}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
