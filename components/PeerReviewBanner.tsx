"use client";

import { Star, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface ReviewSummary {
  totalReviews: number;
  avgRating: number | null;
  distribution: { valid: number; needs_work: number; invalid: number };
}

interface PeerReviewBannerProps {
  summary: ReviewSummary;
}

export default function PeerReviewBanner({ summary }: PeerReviewBannerProps) {
  if (summary.totalReviews === 0) return null;

  const { totalReviews, avgRating, distribution } = summary;
  const dominant =
    distribution.valid >= distribution.needs_work && distribution.valid >= distribution.invalid
      ? "valid"
      : distribution.needs_work >= distribution.invalid
        ? "needs_work"
        : "invalid";

  const dominantConfig = {
    valid:      { label: "Community verified", color: "text-emerald-400", border: "border-emerald-700/40", bg: "bg-emerald-900/20", Icon: CheckCircle },
    needs_work: { label: "Needs refinement",   color: "text-amber-400",   border: "border-amber-700/40",   bg: "bg-amber-900/20",   Icon: AlertCircle },
    invalid:    { label: "Disputed",            color: "text-red-400",     border: "border-red-700/40",     bg: "bg-red-900/20",     Icon: XCircle },
  };

  const cfg = dominantConfig[dominant];
  const DomIcon = cfg.Icon;

  return (
    <div className={`flex items-center gap-4 px-5 py-3 rounded-xl border ${cfg.bg} ${cfg.border} mb-6`}>
      <DomIcon size={16} className={cfg.color} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
        <span className="text-slate-500 text-sm ml-2">· {totalReviews} peer review{totalReviews !== 1 ? "s" : ""}</span>
      </div>
      {avgRating !== null && (
        <div className="flex items-center gap-1 shrink-0">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} size={12} className={star <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
          ))}
          <span className="text-xs text-slate-400 ml-1">{avgRating.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
