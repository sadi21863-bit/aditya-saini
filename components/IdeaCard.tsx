"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Rocket, Trash2, Edit3, Eye, Loader2,
  RotateCcw, Heart, Fingerprint, Lock, Unlock,
} from "lucide-react";
import { launchIdea, deleteIdea, recallIdea, requestAccess } from "@/app/actions/ideaActions";
import FlairBadge from "@/components/FlairBadge";
import type { Idea } from "@/db/schema";

const TIER_CONFIG = {
  dreamer: { color: "text-slate-400", bgColor: "bg-slate-800", borderColor: "border-slate-700" },
  visionary: { color: "text-teal-400", bgColor: "bg-teal-900", borderColor: "border-teal-700" },
  architect: { color: "text-violet-400", bgColor: "bg-violet-900", borderColor: "border-violet-700" },
  oracle: { color: "text-amber-400", bgColor: "bg-amber-900", borderColor: "border-amber-700" },
  initiate: { color: "text-slate-400", bgColor: "bg-slate-800", borderColor: "border-slate-700" },
  master: { color: "text-purple-400", bgColor: "bg-purple-900", borderColor: "border-purple-700" },
  genesis_legend: { color: "text-amber-400", bgColor: "bg-amber-900", borderColor: "border-amber-700" },
} as const;

interface Author {
  name: string | null;
  handle: string | null;
  tier: string | null;
  xp?: number | null;
}

interface IdeaCardProps {
  idea: Idea;
  author?: Author | null;
  viewerId?: string;
  hasLiked?: boolean;
  isOwner?: boolean;
  showActions?: boolean;
  showAccessButtons?: boolean;
}

export default function IdeaCard({
  idea,
  author,
  viewerId = "",
  hasLiked = false,
  isOwner: isOwnerProp,
  showActions = false,
  showAccessButtons = false,
}: IdeaCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [liked, setLiked] = useState(hasLiked);
  const [likeCount, setLikeCount] = useState(idea.totalLikes ?? 0);
  const [hovered, setHovered] = useState(false);

  const run = async (key: string, action: (id: string) => Promise<unknown>) => {
    try {
      setLoading(key);
      await action(idea.id);
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      const t = setTimeout(() => setConfirmDelete(false), 3000);
      setDeleteTimer(t);
    } else {
      if (deleteTimer) clearTimeout(deleteTimer);
      setConfirmDelete(false);
      run("delete", deleteIdea);
    }
  };

  const handleAccessRequest = async (level: "viewer") => {
    setLoading(`access-${level}`);
    const result = await requestAccess(idea.id, level);
    setLoading(null);
    if (result.success) {
      alert(result.message);
      window.location.reload();
    } else {
      alert(result.error ?? "Failed to request access");
    }
  };

  const context = idea.context;
  const protectionLevel = idea.protectionLevel ?? "open";
  const viewerIds: string[] = idea.viewerIds ?? [];
  const hasGenesis = Boolean(idea.genesisHash);

  const tierKey = (author?.tier ?? "dreamer") as keyof typeof TIER_CONFIG;
  const tier = TIER_CONFIG[tierKey] ?? TIER_CONFIG.dreamer;

  const isOwner = isOwnerProp ?? (idea.userId === viewerId && viewerId !== "");
  const isViewer = viewerIds.includes(viewerId);
  const isProtected = protectionLevel !== "open";
  const hasAccess = isOwner || isViewer || !isProtected;
  const isBlurred = isProtected && !hasAccess;

  const canRequestViewer =
    showAccessButtons && !isOwner && !isViewer && isProtected && idea.status === "public";

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4
        hover:border-teal-700 transition-colors duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── COLLAPSED ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Category + Flair row */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest">
              {idea.category ?? "General"}
            </span>
            {/* ✅ Flair Badge */}
            <FlairBadge flair={idea.flair} size="xs" />
          </div>
          <h3 className="text-sm font-bold text-white truncate">
            {idea.title}
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
          <span className={`flex items-center gap-1 ${liked ? "text-rose-400" : ""}`}>
            <Heart size={11} className={liked ? "fill-current" : ""} />
            {likeCount}
          </span>
          <span>👁 {idea.views ?? 0}</span>
          {hasGenesis && <Fingerprint size={11} className="text-emerald-500" />}
          {isBlurred && <Lock size={11} className="text-slate-500" />}
        </div>
      </div>

      {/* ── EXPANDED ────────────────────────────────────────────────────── */}
      <div
        style={{
          maxHeight: hovered ? "300px" : "0px",
          opacity: hovered ? 1 : 0,
          marginTop: hovered ? "12px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, margin-top 0.3s ease-in-out",
        }}
      >
        {context && !isBlurred && (
          <p className="text-sm text-slate-400 line-clamp-3 mb-3">{context}</p>
        )}
        {!context && !isBlurred && (
          <p className="text-sm text-slate-600 italic mb-3">No public pitch added.</p>
        )}
        {isBlurred && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <Lock size={12} />
            <span>Protected — click View to request access</span>
          </div>
        )}

        {/* Author */}
        {author && (
          <Link
            href={`/profile/${author.handle ?? "unknown"}`}
            className="flex items-center gap-2 mb-3 hover:opacity-70 transition-opacity w-fit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center
              font-bold text-[10px] ${tier.bgColor} ${tier.color} border ${tier.borderColor}`}>
              {author.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-none">
                {author.name ?? "Anonymous"}
              </p>
              <p className="text-[10px] text-slate-500">
                @{author.handle ?? "unknown"}
                {author.xp !== undefined && (
                  <span className={`ml-1 font-bold ${tier.color}`}>· {author.xp} XP</span>
                )}
              </p>
            </div>
          </Link>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
          <Link
            href={`/idea/${idea.id}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
              text-white bg-teal-600 rounded-lg hover:bg-teal-500 transition"
          >
            <Eye size={12} /> View
          </Link>

          {canRequestViewer && (
            <button
              onClick={() => handleAccessRequest("viewer")}
              disabled={loading === "access-viewer"}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold
                text-white bg-slate-600 rounded-lg hover:bg-slate-500
                disabled:opacity-50 transition"
            >
              {loading === "access-viewer"
                ? <Loader2 size={12} className="animate-spin" />
                : <Unlock size={12} />}
              Access
            </button>
          )}

          {showActions && (
            <>
              <Link
                href={`/idea/${idea.id}/edit`}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                  text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 transition"
              >
                <Edit3 size={12} /> Edit
              </Link>

              {idea.status === "draft" ? (
                <button
                  onClick={() => run("launch", launchIdea)}
                  disabled={!!loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold
                    text-white bg-teal-600 rounded-lg hover:bg-teal-500
                    disabled:opacity-50 transition"
                >
                  {loading === "launch"
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Rocket size={12} />}
                  Launch
                </button>
              ) : (
                <button
                  onClick={() => run("recall", recallIdea)}
                  disabled={!!loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                    text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700
                    disabled:opacity-50 transition"
                >
                  {loading === "recall"
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RotateCcw size={12} />}
                  Recall
                </button>
              )}

              <button
                onClick={handleDeleteClick}
                disabled={loading === "delete"}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
                  rounded-lg disabled:opacity-50 transition-all ${confirmDelete
                    ? "bg-red-600 text-white animate-pulse"
                    : "text-red-400 bg-slate-800 hover:bg-red-900/30"
                  }`}
              >
                {loading === "delete"
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
                {confirmDelete ? "Sure?" : "Del"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
