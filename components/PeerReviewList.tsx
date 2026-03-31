"use client";

import { useState, useEffect } from "react";
import { Star, ChevronDown, ChevronUp, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { getReviews, getReviewSummary } from "@/app/actions/reviewActions";
import CommentWithReview from "@/components/CommentWithReview";

interface PeerReviewListProps {
  ideaId: string;
}

export default function PeerReviewList({ ideaId }: PeerReviewListProps) {
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof getReviews>>>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getReviewSummary>> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getReviews(ideaId), getReviewSummary(ideaId)]).then(([r, s]) => {
      setReviews(r);
      setSummary(s);
      setLoading(false);
    });
  }, [ideaId]);

  if (loading) return <div className="h-8 animate-pulse bg-slate-800/40 rounded-xl" />;
  if (!summary || summary.totalReviews === 0) return null;

  const dist = summary.distribution;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white text-sm">Peer Reviews</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{summary.totalReviews}</span>
          {summary.avgRating && (
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} size={11} className={s <= Math.round(summary.avgRating!) ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
              ))}
              <span className="text-xs text-slate-400 ml-0.5">{summary.avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Verdict distribution pills */}
          <div className="flex items-center gap-1.5">
            {dist.valid > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
                <CheckCircle size={9} />{dist.valid}
              </span>
            )}
            {dist.needs_work > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-700/40">
                <AlertCircle size={9} />{dist.needs_work}
              </span>
            )}
            {dist.invalid > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/40">
                <XCircle size={9} />{dist.invalid}
              </span>
            )}
          </div>
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Review list */}
      {expanded && (
        <div className="px-6 pb-6 flex flex-col gap-4 border-t border-slate-800 pt-4">
          {reviews.map((review) => (
            <CommentWithReview
              key={review.id}
              commentId={review.id}
              content="" /* reviews stand alone — no comment text */
              createdAt={review.createdAt}
              user={review.user}
              review={review}
            />
          ))}
        </div>
      )}
    </div>
  );
}
