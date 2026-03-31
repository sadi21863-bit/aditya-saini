"use client";

import { CheckCircle, AlertCircle, XCircle, Star, Tag } from "lucide-react";
import Link from "next/link";

interface ReviewData {
  id: string;
  verdict: string;
  rating: number;
  tags: string[];
}

interface CommentUser {
  id: string | null;
  name: string | null;
  handle: string | null;
  tier: string | null;
  xp: number;
}

interface CommentWithReviewProps {
  commentId: string;
  content: string;
  createdAt: Date | null;
  user: CommentUser;
  review?: ReviewData | null;
  parentId?: string | null;
}

const VERDICT_CONFIG = {
  valid:      { label: "Valid",      color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-700/50", Icon: CheckCircle },
  needs_work: { label: "Needs Work", color: "text-amber-400",   bg: "bg-amber-900/30 border-amber-700/50",   Icon: AlertCircle },
  invalid:    { label: "Invalid",    color: "text-red-400",     bg: "bg-red-900/30 border-red-700/50",       Icon: XCircle },
};

const TAG_LABELS: Record<string, string> = {
  well_researched: "Well Researched",
  vague:           "Vague",
  duplicate:       "Duplicate",
  innovative:      "Innovative",
};

export default function CommentWithReview({ commentId, content, createdAt, user, review, parentId }: CommentWithReviewProps) {
  const ago = createdAt ? formatAgo(createdAt) : "";
  const verdictCfg = review ? VERDICT_CONFIG[review.verdict as keyof typeof VERDICT_CONFIG] : null;

  return (
    <div className={`flex gap-3 ${parentId ? "ml-8 pl-4 border-l border-slate-800" : ""}`}>
      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 mt-0.5">
        {user.name?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Link href={`/profile/${user.handle ?? "unknown"}`} className="text-xs font-semibold text-white hover:text-teal-400 transition-colors">
            {user.name ?? "Anonymous"}
          </Link>
          <span className="text-[10px] text-slate-600">{ago}</span>
          {verdictCfg && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${verdictCfg.bg} ${verdictCfg.color}`}>
              <verdictCfg.Icon size={9} />{verdictCfg.label}
            </span>
          )}
        </div>

        {/* Peer review section if attached */}
        {review && (
          <div className="mb-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={11} className={s <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
              ))}
              <span className="text-[10px] text-slate-500">{review.rating}/5</span>
            </div>
            {review.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {review.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 border border-slate-600/40">
                    <Tag size={8} />{TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function formatAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
