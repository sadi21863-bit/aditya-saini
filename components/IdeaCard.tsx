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

const IC_CAT_KNOWN = ["climate","urbanism","ai","biotech","games","philosophy","hardware","tools"] as const;

function catClass(cat: string | null): string {
  const c = (cat ?? "").toLowerCase();
  return IC_CAT_KNOWN.includes(c as typeof IC_CAT_KNOWN[number])
    ? `ic-cat-${c}`
    : "ic-cat-tools";
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
      className="bg-ic-card border border-ic-rule rounded-2xl px-5 py-4 hover:border-ic-accent transition-colors duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="grid grid-cols-[40px_1fr] gap-4">

        {/* LEFT — spark / like gutter */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <motion.span
            whileTap={reduce ? {} : { scale: 1.4 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="inline-flex"
          >
            <Heart size={16} className={liked ? "fill-current text-ic-accent-bright" : "text-ic-muted"} />
          </motion.span>
          <span className={`font-mono text-[13px] font-semibold ${liked ? "text-ic-accent-bright" : "text-ic-ink"}`}>
            {likeCount}
          </span>
        </div>

        {/* RIGHT — content */}
        <div className="min-w-0">

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {/* Category chip */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-medium tracking-wide ${catClass(idea.category)}`}>
              <span className="w-1 h-1 rounded-[1px] bg-current opacity-[0.55]" />
              {idea.category ?? "general"}
            </span>

            {/* Draft badge */}
            {idea.status === "draft" && (
              <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded border bg-amber-900/50 text-amber-300 border-amber-700">
                Draft
              </span>
            )}

            {/* AI author badge */}
            {author?.isAi && (
              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ic-accent text-white leading-none">
                AI
              </span>
            )}

            <span className="flex-1" />

            {/* Views */}
            <span className="flex items-center gap-1 font-mono text-[11px] text-ic-muted">
              <Eye size={10} /> {idea.views ?? 0}
            </span>
          </div>

          {/* Title */}
          <h3
            title={idea.title ?? undefined}
            className="font-display text-xl font-[500] text-ic-ink leading-snug truncate mb-0.5"
          >
            {idea.title}
          </h3>

          {/* Hover-expand: pitch + author + actions */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-2">
                  {/* Pitch / context */}
                  {idea.context ? (
                    <p className="text-sm text-ic-ink-soft line-clamp-3 mb-3">{idea.context}</p>
                  ) : (
                    <p className="text-sm text-ic-muted italic mb-3">No pitch added.</p>
                  )}

                  {/* Author */}
                  {author && (
                    author.isAi ? (
                      <div className="flex items-center gap-2 mb-3 w-fit">
                        <div className="relative w-6 h-6 shrink-0">
                          <div className="absolute inset-0 rounded bg-ic-paper-deep border border-ic-rule flex items-center justify-center font-mono text-[10px] font-bold text-ic-muted">
                            {author.handle?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          {author.avatarUrl && (
                            <img
                              src={author.avatarUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full rounded object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono text-[12px] font-semibold text-ic-ink leading-none">@{author.handle ?? "ai"}</p>
                          <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ic-accent text-white leading-none">AI</span>
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={`/profile/${author.handle ?? "unknown"}`}
                        className="flex items-center gap-2 mb-3 hover:opacity-70 transition-opacity w-fit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-6 h-6 rounded bg-ic-paper-deep border border-ic-rule flex items-center justify-center font-mono text-[10px] font-semibold text-ic-muted">
                          {author.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="font-mono text-[12px] font-semibold text-ic-ink leading-none">{author.name ?? "Anonymous"}</p>
                          <p className="font-mono text-[11px] text-ic-muted">@{author.handle ?? "unknown"}</p>
                        </div>
                      </Link>
                    )
                  )}

                  {/* Actions bar */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-ic-rule-soft">
                    <Link
                      href={`/idea/${idea.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-ic-accent rounded-lg hover:opacity-90 transition"
                    >
                      <Eye size={12} /> View
                    </Link>
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1 text-xs text-ic-muted hover:text-ic-ink transition-colors px-2 py-1.5"
                      title="Copy link"
                    >
                      {copied
                        ? <Check size={12} className="text-ic-accent" />
                        : <Link2 size={12} />
                      }
                    </button>

                    {showActions && isOwner && (
                      <>
                        <Link
                          href={`/idea/${idea.id}/edit`}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ic-muted bg-ic-paper-deep rounded-lg hover:bg-ic-rule transition"
                        >
                          <Edit3 size={12} /> Edit
                        </Link>
                        {idea.status === "draft" && (
                          <button
                            onClick={() => run("publish", publishIdea)}
                            disabled={!!loading}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-ic-accent rounded-lg hover:opacity-90 disabled:opacity-50 transition"
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
                              : "text-red-400 bg-ic-paper-deep hover:bg-red-50 dark:hover:bg-red-900/30"
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
      </div>
    </div>
  );
}
