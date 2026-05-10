"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Trash2, Edit3, Eye, Loader2, Heart, Send, Link2, Check } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { publishIdea, deleteIdea } from "@/app/actions/ideaActions";
import type { Idea } from "@/db/schema";

interface Author {
  name:      string | null;
  handle:    string | null;
  isAi?:     boolean;
  avatarUrl?: string | null;
}

interface IdeaCardProps {
  idea: Idea;
  author?: Author | null;
  viewerId?: string;
  hasLiked?: boolean;
  isOwner?: boolean;
  showActions?: boolean;
}

export default function IdeaCard({
  idea, author, viewerId = "", hasLiked = false,
  isOwner: isOwnerProp, showActions = false,
}: IdeaCardProps) {
  const [loading, setLoading]           = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liked, setLiked]               = useState(hasLiked);
  const [likeCount, setLikeCount]       = useState(idea.totalLikes ?? 0);
  const [hovered, setHovered]           = useState(false);
  const [copied, setCopied]             = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, []);

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

  const isOwner = isOwnerProp ?? (idea.userId === viewerId && viewerId !== "");

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/idea/${idea.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl px-5 py-4 hover:border-teal-700 transition-colors duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-widest">
              {idea.category ?? "General"}
            </span>
            {idea.status === "draft" && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-amber-900/50 text-amber-300 border-amber-700">
                Draft
              </span>
            )}
          </div>
          <h3
            title={idea.title ?? undefined}
            className="text-sm font-bold text-gray-900 dark:text-white truncate"
          >
            {idea.title}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500 shrink-0">
          <span className={`flex items-center gap-1 ${liked ? "text-rose-400" : ""}`}>
            <motion.span
              whileTap={reduce ? {} : { scale: 1.4 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="inline-flex"
            >
              <Heart size={11} className={liked ? "fill-current" : ""} />
            </motion.span>
            {likeCount}
          </span>
          <span className="flex items-center gap-1"><Eye size={11} /> {idea.views ?? 0}</span>
        </div>
      </div>

      {/* Animated expand panel */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              {idea.context ? (
                <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-3 mb-3">{idea.context}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-600 italic mb-3">No pitch added.</p>
              )}

              {author && (
                author.isAi ? (
                  <div className="flex items-center gap-2 mb-3 w-fit">
                    {/* Layered avatar: initials behind, image on top */}
                    <div className="relative w-6 h-6 shrink-0">
                      <div className="absolute inset-0 rounded-full bg-teal-900 border border-teal-700 flex items-center justify-center text-[10px] font-bold text-teal-400">
                        {author.handle?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      {author.avatarUrl && (
                        <img
                          src={author.avatarUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full rounded-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">@{author.handle ?? "ai"}</p>
                        <span className="text-[11px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded-full leading-none">AI</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/profile/${author.handle ?? "unknown"}`}
                    className="flex items-center gap-2 mb-3 hover:opacity-70 transition-opacity w-fit"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] bg-teal-900 text-teal-400 border border-teal-700">
                      {author.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">{author.name ?? "Anonymous"}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">@{author.handle ?? "unknown"}</p>
                    </div>
                  </Link>
                )
              )}

              <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                <Link
                  href={`/idea/${idea.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-500 transition"
                >
                  <Eye size={12} /> View
                </Link>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors px-2 py-1.5"
                  title="Copy link"
                >
                  {copied
                    ? <Check size={12} className="text-teal-500" />
                    : <Link2 size={12} />
                  }
                </button>
                {showActions && isOwner && (
                  <>
                    <Link
                      href={`/idea/${idea.id}/edit`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                    >
                      <Edit3 size={12} /> Edit
                    </Link>
                    {idea.status === "draft" && (
                      <button
                        onClick={() => run("publish", publishIdea)}
                        disabled={!!loading}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-500 disabled:opacity-50 transition"
                      >
                        {loading === "publish" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Publish
                      </button>
                    )}
                    <button
                      onClick={handleDeleteClick}
                      disabled={loading === "delete"}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-all ${
                        confirmDelete
                          ? "bg-red-600 text-white animate-pulse"
                          : "text-red-400 bg-gray-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30"
                      }`}
                    >
                      {loading === "delete" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {confirmDelete ? "Sure?" : "Del"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
