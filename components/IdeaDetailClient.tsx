"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Lock, Unlock, Fingerprint, GitBranch, Eye, Zap, Calendar, PenLine,
} from "lucide-react";
import SparkButton from "@/components/SparkButton";
import type { Idea, User } from "@/db/schema";
import { getTierFromXp } from "@/lib/tier-engine";
import Link from "next/link";

// v13: protectionLevel removed from schema. ipProtected is a boolean.
// If ipProtected=true the content is gated behind a spark.
// blurLevel is now binary: 0 (open) or 1 (ip-protected).

const HONEST_HOOK_CHARS = 150;

interface CommentUser {
  id: string | null;
  name: string | null;
  handle: string | null;
  image: string | null;
  tier: string | null;
  xp: number;
}
interface Comment {
  id: string;
  content: string;
  createdAt: Date | null;
  user: CommentUser;
}

interface IdeaDetailClientProps {
  idea: Idea;
  author: User | null;
  viewerId: string;
  hasLiked: boolean;
  isOwner: boolean;
  isPartner: boolean;
  initialComments: Comment[];
}

export default function IdeaDetailClient({
  idea,
  author,
  viewerId,
  hasLiked,
  isOwner,
  isPartner,
  initialComments,
}: IdeaDetailClientProps) {
  const [isRevealed, setIsRevealed] = useState(hasLiked || isOwner || isPartner);
  const [commentCount, setCommentCount] = useState(initialComments.length);
  const contentRef = useRef<HTMLDivElement>(null);

  // v13: binary lock — either open or ip-protected
  const isProtected = Boolean(idea.ipProtected);
  const isLocked = isProtected && !isRevealed;

  const domain = idea.domain ?? "private";
  const isPrivate = domain === "private" || domain === "vault";
  const hasGenesis = Boolean(idea.genesisHash);
  const isRemix = Boolean(idea.remixedFromId);

  const fullContent = idea.content ?? "";
  const clearPart = fullContent.slice(0, HONEST_HOOK_CHARS);
  const blurPart = fullContent.slice(HONEST_HOOK_CHARS);
  const hasBlurPart = blurPart.length > 0;

  // Copy protection for IP-protected ideas
  const blockCopy = useCallback((e: ClipboardEvent) => {
    if (isProtected) e.preventDefault();
  }, [isProtected]);

  const blockContextMenu = useCallback((e: MouseEvent) => {
    if (isProtected) e.preventDefault();
  }, [isProtected]);

  const blockKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (!isProtected) return;
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && ["a", "c", "x"].includes(e.key.toLowerCase())) e.preventDefault();
  }, [isProtected]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isProtected) return;
    el.addEventListener("copy", blockCopy);
    el.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeyboardShortcuts);
    return () => {
      el.removeEventListener("copy", blockCopy);
      el.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeyboardShortcuts);
    };
  }, [isProtected, blockCopy, blockContextMenu, blockKeyboardShortcuts]);

  const authorTier = author ? getTierFromXp(author.xp ?? 0) : null;

  return (
    <div className="space-y-6">
      <article className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#0d9488] via-teal-400 to-violet-500" />

        <div className="px-8 pt-8 pb-6">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 uppercase tracking-wider">
              {idea.category ?? "General"}
            </span>

            {/* Domain badge */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border uppercase tracking-wider ${
              isPrivate
                ? "text-violet-400 bg-violet-900/30 border-violet-800"
                : "text-teal-400 bg-teal-900/30 border-teal-800"
            }`}>
              {isPrivate ? <Lock size={11} /> : <Unlock size={11} />}
              {isPrivate ? "Private" : "Public"}
            </span>

            {/* IP protection badge */}
            {isProtected && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border uppercase tracking-wider text-amber-400 bg-amber-900/30 border-amber-800">
                <Lock size={11} /> IP Protected
              </span>
            )}

            {/* Genesis hash badge */}
            {hasGenesis && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border uppercase tracking-wider text-emerald-400 bg-emerald-900/30 border-emerald-800">
                <Fingerprint size={11} /> Genesis Verified
              </span>
            )}

            {/* Remix badge */}
            {isRemix && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border uppercase tracking-wider text-blue-400 bg-blue-900/30 border-blue-800">
                <GitBranch size={11} /> Remix
              </span>
            )}

            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar size={11} />
              {idea.createdAt
                ? new Date(idea.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                : ""}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-5 tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
            {idea.title}
          </h1>

          {idea.context && (
            <p className="text-lg text-[#0d9488] italic font-medium mb-6 pb-6 border-b border-slate-800 leading-relaxed">
              &quot;{idea.context}&quot;
            </p>
          )}

          {author && (
            <div className="flex items-center gap-3 py-4 border-b border-slate-800/60">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0d9488] to-teal-300 flex items-center justify-center text-white font-bold text-sm border-2 border-slate-700 shadow">
                {(author.name ?? author.id)[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${author.handle ?? author.id}`} className="text-sm font-bold text-white hover:text-[#0d9488] transition-colors">
                    @{author.handle ?? author.name ?? "Unknown"}
                  </Link>
                  {authorTier && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${authorTier.color} ${authorTier.bgColor}`}>
                      {authorTier.displayName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Genesis Creator</p>
              </div>

              <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Eye size={12} />{idea.views ?? 0} views</span>
                <span className="flex items-center gap-1.5"><Zap size={12} />{idea.totalLikes ?? 0} sparks</span>
                <span className="flex items-center gap-1.5"><GitBranch size={12} />{commentCount} comments</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-8 pb-8" ref={contentRef}>
          <div className={`mt-2 ${isProtected ? "select-none" : ""}`}>
            <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
              {clearPart}
              {hasBlurPart && isLocked && (
                <span className="text-slate-700 select-none">…</span>
              )}
            </p>
          </div>

          {hasBlurPart && isProtected && (
            <div className="relative mt-4">
              <div className={`transition-all duration-700 ease-in-out ${isRevealed ? "blur-none" : "blur-md pointer-events-none select-none"}`} aria-hidden={!isRevealed}>
                <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">{blurPart}</p>
              </div>

              {isLocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent rounded-2xl min-h-[140px] gap-4 pointer-events-auto">
                  <div className="flex flex-col items-center gap-2 text-center px-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center mb-1">
                      <Zap size={22} className="text-[#0d9488]" />
                    </div>
                    <p className="text-white font-bold text-sm">Spark to reveal the full idea</p>
                    <p className="text-slate-400 text-xs max-w-xs">Like this idea to unlock the complete vision.</p>
                  </div>
                  {!isOwner && (
                    <SparkButton
                      ideaId={idea.id}
                      viewerId={viewerId}
                      initialLikes={idea.totalLikes ?? 0}
                      onSuccess={() => setIsRevealed(true)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {hasBlurPart && !isProtected && (
            <div className="mt-4">
              <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">{blurPart}</p>
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between flex-wrap gap-4">
          {!isLocked && !isOwner && (
            <SparkButton
              ideaId={idea.id}
              viewerId={viewerId}
              initialLikes={idea.totalLikes ?? 0}
              onSuccess={() => setIsRevealed(true)}
            />
          )}

          <div className="flex items-center gap-3 ml-auto">
            {isOwner && (
              <Link href={`/idea/${idea.id}/edit`} className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
                <PenLine size={12} /> Edit Idea
              </Link>
            )}
            {isOwner && (
              <Link href={`/idea/${idea.id}/manage`} className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 hover:bg-[#0d9488]/20 transition-colors">
                <GitBranch size={12} /> Manage
              </Link>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
