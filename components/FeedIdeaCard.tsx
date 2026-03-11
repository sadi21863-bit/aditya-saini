"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Eye, Fingerprint, Lock, Loader2, Unlock } from "lucide-react";
import { sparkIdea, requestAccess } from "@/app/actions/ideaActions";
import type { Idea } from "@/db/schema";

const TIER_COLORS: Record<string, string> = {
  initiate:       "bg-slate-100 text-slate-600",
  architect:      "bg-teal-50 text-teal-700",
  master:         "bg-purple-50 text-purple-700",
  genesis_legend: "bg-amber-50 text-amber-700",
};

interface Author {
  id: string;
  name: string | null;
  handle: string | null;
  image: string | null;
  tier: string | null;
}

interface FeedIdeaCardProps {
  idea: Idea;
  author?: Author | null;
  viewerId: string;
}

export default function FeedIdeaCard({ idea, author, viewerId }: FeedIdeaCardProps) {
  const [hovered, setHovered]           = useState(false);
  const [liking, setLiking]             = useState(false);
  const [liked, setLiked]               = useState(false);
  const [likeCount, setLikeCount]       = useState(idea.totalLikes ?? 0);
  const [accessLoading, setAccessLoading] = useState(false);

  const isOwner    = idea.userId === viewerId;
  const isViewer   = idea.viewerIds?.includes(viewerId) ?? false;
  const isPartner  = idea.partnerIds?.includes(viewerId) ?? false;
  const blurLevel  = idea.blurLevel ?? 0;
  const isBlurred  = blurLevel > 0 && !isOwner && !isViewer && !isPartner;
  const hasGenesis = Boolean(idea.genesisHash);

  const tierColor = TIER_COLORS[author?.tier ?? "initiate"] ?? TIER_COLORS.initiate;
  const summary   = idea.hook || (idea.content ? idea.content.slice(0, 120) + "…" : null);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (liked || liking) return;
    setLiking(true);
    const result = await sparkIdea(idea.id, viewerId);
    if (result.success) {
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
    setLiking(false);
  };

  const handleAccess = async (e: React.MouseEvent) => {
    e.preventDefault();
    setAccessLoading(true);
    const result = await requestAccess(idea.id, "viewer");
    setAccessLoading(false);
    if (result.success) {
      alert(result.message);
      window.location.reload();
    } else {
      alert(result.error || "Failed");
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group bg-white border border-slate-100 rounded-2xl transition-all
        duration-300 overflow-hidden hover:border-[#0d9488]/40 hover:shadow-lg"
    >
      {/* ── COLLAPSED (always visible) ──────────────────────────────────── */}
      <div className="p-5">

        {/* Category row + badges */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[#0d9488] uppercase tracking-widest">
            {idea.category ?? "General"}
          </span>
          <div className="flex items-center gap-1.5">
            {hasGenesis && (
              <span className="flex items-center gap-1 text-[9px] font-bold
                text-emerald-600 bg-emerald-50 border border-emerald-200
                px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                <Fingerprint size={8} /> Genesis
              </span>
            )}
            {isBlurred && (
              <span className="flex items-center gap-1 text-[9px] font-bold
                text-slate-500 bg-slate-100 border border-slate-200
                px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                <Lock size={8} /> Protected
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className="font-bold text-slate-900 text-base leading-snug
            group-hover:text-[#0d9488] transition-colors line-clamp-2"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {idea.title}
        </h3>

        {/* Author */}
        <div className="flex items-center gap-2 mt-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center
            text-[10px] font-bold ${tierColor}`}>
            {author?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {author?.name || "Anonymous"}
            {author?.handle && (
              <span className="text-slate-400 ml-1">@{author.handle}</span>
            )}
          </span>
        </div>
      </div>

      {/* ── EXPANDED (on hover) ─────────────────────────────────────────── */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          hovered ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 space-y-4">

          {/* Summary or blur guard */}
          {isBlurred ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <Lock className="mx-auto text-slate-400 mb-2" size={18} />
              <p className="text-xs text-slate-500 mb-3">This content is protected.</p>
              <button
                onClick={handleAccess}
                disabled={accessLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                  text-white bg-slate-700 rounded-xl hover:bg-slate-800
                  disabled:opacity-50 transition-colors"
              >
                {accessLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Unlock size={12} />}
                Get Access
              </button>
            </div>
          ) : (
            summary && (
              <p className="text-sm text-slate-500 italic leading-relaxed line-clamp-3">
                "{summary}"
              </p>
            )
          )}

          {/* Like / views / More link */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
              <button
                onClick={handleLike}
                disabled={liking || liked}
                className={`flex items-center gap-1.5 transition-all
                  hover:scale-110 active:scale-95
                  ${liked ? "text-rose-500" : "hover:text-rose-400"}`}
              >
                <Heart size={13} className={liked ? "fill-current" : ""} />
                {likeCount}
              </button>
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {idea.views ?? 0}
              </span>
            </div>

            <Link
              href={`/idea/${idea.id}`}
              className="text-xs font-bold text-[#0d9488] hover:underline"
            >
              More →
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
