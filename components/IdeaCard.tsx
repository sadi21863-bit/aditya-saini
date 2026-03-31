"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Rocket, Trash2, Edit3, Eye, Loader2, RotateCcw, Heart, Fingerprint, Lock, GitBranch } from "lucide-react";
import { launchIdea, deleteIdea, recallIdea } from "@/app/actions/ideaActions";
import type { Idea } from "@/db/schema";

const TIER_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  explorer: { color: "text-slate-400", bgColor: "bg-slate-800", borderColor: "border-slate-700" },
  builder: { color: "text-teal-400", bgColor: "bg-teal-900", borderColor: "border-teal-700" },
  architect: { color: "text-violet-400", bgColor: "bg-violet-900", borderColor: "border-violet-700" },
  pioneer: { color: "text-amber-400", bgColor: "bg-amber-900", borderColor: "border-amber-700" },
  starter: { color: "text-slate-400", bgColor: "bg-slate-800", borderColor: "border-slate-700" },
  grand_architect: { color: "text-amber-400", bgColor: "bg-amber-900", borderColor: "border-amber-700" },
};

interface Author { name: string | null; handle: string | null; tier: string | null; xp?: number | null; }

interface IdeaCardProps {
  idea: Idea;
  author?: Author | null;
  viewerId?: string;
  hasLiked?: boolean;
  isOwner?: boolean;
  showActions?: boolean;
}

export default function IdeaCard({ idea, author, viewerId = "", hasLiked = false, isOwner: isOwnerProp, showActions = false }: IdeaCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liked, setLiked] = useState(hasLiked);
  const [likeCount, setLikeCount] = useState(idea.totalLikes ?? 0);
  const [hovered, setHovered] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }; }, []);

  const run = async (key: string, action: (id: string) => Promise<unknown>) => {
    try { setLoading(key); await action(idea.id); } catch {} finally { setLoading(null); }
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDelete(false);
      run("delete", deleteIdea);
    }
  };

  const domain = idea.domain ?? "private";
  const isPrivate = domain === "private" || domain === "vault";
  const hasGenesis = Boolean(idea.genesisHash);
  const isRemix = Boolean(idea.remixedFromId);
  const tierKey = (author?.tier ?? "explorer") as keyof typeof TIER_CONFIG;
  const tier = TIER_CONFIG[tierKey] ?? TIER_CONFIG.explorer;
  const isOwner = isOwnerProp ?? (idea.userId === viewerId && viewerId !== "");

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 hover:border-teal-700 transition-colors duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest">{idea.category ?? "General"}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${isPrivate ? "bg-violet-900/50 text-violet-300 border-violet-700" : "bg-teal-900/50 text-teal-300 border-teal-700"}`}>
              {isPrivate && <Lock size={9} />}{isPrivate ? "Private" : "Public"}
            </span>
            {isRemix && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-900/40 text-blue-300 border-blue-700"><GitBranch size={9} />Remix</span>}
          </div>
          <h3 className="text-sm font-bold text-white truncate">{idea.title}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
          <span className={`flex items-center gap-1 ${liked ? "text-rose-400" : ""}`}><Heart size={11} className={liked ? "fill-current" : ""} />{likeCount}</span>
          <span>👁 {idea.views ?? 0}</span>
          {hasGenesis && <Fingerprint size={11} className="text-emerald-500" />}
        </div>
      </div>

      <div style={{ maxHeight: hovered ? "300px" : "0px", opacity: hovered ? 1 : 0, marginTop: hovered ? "12px" : "0px", overflow: "hidden", transition: "max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, margin-top 0.3s ease-in-out" }}>
        {idea.context ? <p className="text-sm text-slate-400 line-clamp-3 mb-3">{idea.context}</p> : <p className="text-sm text-slate-600 italic mb-3">No pitch added.</p>}

        {author && (
          <Link href={`/profile/${author.handle ?? "unknown"}`} className="flex items-center gap-2 mb-3 hover:opacity-70 transition-opacity w-fit" onClick={(e) => e.stopPropagation()}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${tier.bgColor} ${tier.color} border ${tier.borderColor}`}>
              {author.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-none">{author.name ?? "Anonymous"}</p>
              <p className="text-[10px] text-slate-500">@{author.handle ?? "unknown"}{author.xp !== undefined && <span className={`ml-1 font-bold ${tier.color}`}>· {author.xp} XP</span>}</p>
            </div>
          </Link>
        )}

        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
          <Link href={`/idea/${idea.id}`} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-500 transition"><Eye size={12} /> View</Link>
          {showActions && (
            <>
              <Link href={`/idea/${idea.id}/edit`} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 transition"><Edit3 size={12} /> Edit</Link>
              {idea.status === "draft" ? (
                <button onClick={() => run("launch", launchIdea)} disabled={!!loading} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-500 disabled:opacity-50 transition">
                  {loading === "launch" ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Launch
                </button>
              ) : (
                <button onClick={() => run("recall", recallIdea)} disabled={!!loading} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition">
                  {loading === "recall" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Recall
                </button>
              )}
              <button onClick={handleDeleteClick} disabled={loading === "delete"} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-all ${confirmDelete ? "bg-red-600 text-white animate-pulse" : "text-red-400 bg-slate-800 hover:bg-red-900/30"}`}>
                {loading === "delete" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {confirmDelete ? "Sure?" : "Del"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
