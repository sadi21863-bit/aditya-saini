"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ShieldCheck, Shield, ShieldOff, Lock,
  Fingerprint, GitBranch, Eye, Zap, Calendar, PenLine,
} from "lucide-react";
import SparkButton from "@/components/SparkButton";
import CommentsSection from "@/components/CommentsSection";
import type { Idea, User } from "@/db/schema";
import { getTierFromXp } from "@/lib/tier-engine";
import Link from "next/link";

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

const SHIELD_CONFIG = {
  0: { label: "Open", Icon: ShieldOff, textColor: "text-slate-400", badgeCls: "bg-slate-800 border-slate-700" },
  1: { label: "Guarded", Icon: Shield, textColor: "text-blue-400", badgeCls: "bg-blue-900/30 border-blue-800" },
  2: { label: "Shielded", Icon: ShieldCheck, textColor: "text-violet-400", badgeCls: "bg-violet-900/30 border-violet-800" },
  3: { label: "Vault", Icon: Lock, textColor: "text-amber-400", badgeCls: "bg-amber-900/30 border-amber-800" },
} as const;

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
  const contentRef = useRef<HTMLDivElement>(null);

  const protectionLevel = idea.protectionLevel ?? "open";
  const blurLevel =
    protectionLevel === "vault" ? 3 :
      protectionLevel === "shielded" ? 2 :
        protectionLevel === "guarded" ? 1 : 0;

  const safeLevel = (blurLevel in SHIELD_CONFIG ? blurLevel : 0) as 0 | 1 | 2 | 3;
  const shieldCfg = SHIELD_CONFIG[safeLevel];
  const ShieldIcon = shieldCfg.Icon;

  const fullContent = idea.content ?? "";
  const clearPart = fullContent.slice(0, HONEST_HOOK_CHARS);
  const blurPart = fullContent.slice(HONEST_HOOK_CHARS);
  const hasBlurPart = blurPart.length > 0;

  const blockCopy = useCallback((e: ClipboardEvent) => {
    if (blurLevel >= 2) e.preventDefault();
  }, [blurLevel]);

  const blockContextMenu = useCallback((e: MouseEvent) => {
    if (blurLevel >= 2) e.preventDefault();
  }, [blurLevel]);

  const blockKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (blurLevel < 2) return;
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && ["a", "c", "x"].includes(e.key.toLowerCase())) e.preventDefault();
  }, [blurLevel]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || blurLevel < 2) return;
    el.addEventListener("copy", blockCopy);
    el.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeyboardShortcuts);
    return () => {
      el.removeEventListener("copy", blockCopy);
      el.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeyboardShortcuts);
    };
  }, [blurLevel, blockCopy, blockContextMenu, blockKeyboardShortcuts]);

  const contentWrapperCls = [
    blurLevel >= 1 ? "select-none" : "",
    blurLevel >= 2 ? "pointer-events-none" : "",
  ].filter(Boolean).join(" ");

  const authorTier = author ? getTierFromXp(author.xp ?? 0) : null;

  return (
    <div className="space-y-6">

      {/* ── MAIN CARD ─────────────────────────────────────────────────── */}
      <article className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">

        {/* Gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#0d9488] via-teal-400 to-violet-500" />

        {/* HEADER */}
        <div className="px-8 pt-8 pb-6">

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0d9488]/10
              text-[#0d9488] border border-[#0d9488]/20 uppercase tracking-wider">
              {idea.category ?? "General"}
            </span>

            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
              rounded-full border uppercase tracking-wider
              ${shieldCfg.textColor} ${shieldCfg.badgeCls}`}>
              <ShieldIcon size={11} />
              {shieldCfg.label}
            </span>

            {idea.genesisHash && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
                rounded-full border uppercase tracking-wider
                text-emerald-400 bg-emerald-900/30 border-emerald-800">
                <Fingerprint size={11} />
                Genesis Verified
              </span>
            )}

            {isPartner && !isOwner && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
                rounded-full border uppercase tracking-wider
                text-violet-400 bg-violet-900/30 border-violet-800">
                <GitBranch size={11} />
                Verified Partner
              </span>
            )}

            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar size={11} />
              {idea.createdAt
                ? new Date(idea.createdAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })
                : ""}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-white leading-tight mb-5 tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}>
            {idea.title}
          </h1>

          {/* Public pitch */}
          {idea.context && (
            <p className="text-lg text-[#0d9488] italic font-medium mb-6 pb-6
              border-b border-slate-800 leading-relaxed">
              "{idea.context}"
            </p>
          )}

          {/* Author */}
          {author && (
            <div className="flex items-center gap-3 py-4 border-b border-slate-800/60">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0d9488] to-teal-300
                flex items-center justify-center text-white font-bold text-sm border-2 border-slate-700 shadow">
                {(author.name ?? author.id)[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/profile/${author.handle ?? author.id}`}
                    className="text-sm font-bold text-white hover:text-[#0d9488] transition-colors"
                  >
                    @{author.handle ?? author.name ?? "Unknown"}
                  </Link>
                  {authorTier && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                      uppercase tracking-wider ${authorTier.color} ${authorTier.bgColor}`}>
                      {authorTier.displayName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Genesis Creator</p>
              </div>

              {/* Stats inline */}
              <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Eye size={12} />
                  {idea.views ?? 0} views
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap size={12} />
                  {idea.totalLikes ?? 0} sparks
                </span>
                <span className="flex items-center gap-1.5">
                  <GitBranch size={12} />
                  {initialComments.length} comments
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="px-8 pb-8" ref={contentRef}>
          <div className={`mt-2 ${contentWrapperCls}`}>
            <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
              {clearPart}
              {hasBlurPart && !isRevealed && blurLevel === 3 && (
                <span className="text-slate-700 select-none">…</span>
              )}
            </p>
          </div>

          {/* Vault blur overlay */}
          {hasBlurPart && blurLevel === 3 && (
            <div className="relative mt-4">
              <div className={`transition-all duration-700 ease-in-out ${isRevealed ? "blur-none" : "blur-md pointer-events-none select-none"
                } ${contentWrapperCls}`} aria-hidden={!isRevealed}>
                <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
                  {blurPart}
                </p>
              </div>

              {!isRevealed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center
                  bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent
                  rounded-2xl min-h-[140px] gap-4 pointer-events-auto">
                  <div className="flex flex-col items-center gap-2 text-center px-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#0d9488]/10 border border-[#0d9488]/20
                      flex items-center justify-center mb-1">
                      <Zap size={22} className="text-[#0d9488]" />
                    </div>
                    <p className="text-white font-bold text-sm">Spark to reveal the full idea</p>
                    <p className="text-slate-400 text-xs max-w-xs">
                      Like this idea to unlock the complete vision from the Genesis Creator.
                    </p>
                  </div>
                  <SparkButton
                    ideaId={idea.id}
                    viewerId={viewerId}
                    initialLikes={idea.totalLikes ?? 0}
                    onSuccess={() => setIsRevealed(true)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Non-vault protected content */}
          {blurLevel < 3 && hasBlurPart && (
            <div className={`mt-4 ${contentWrapperCls}`}>
              <p className="text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
                {blurPart}
              </p>
            </div>
          )}

          {/* Genesis Certificate */}
          {idea.genesisHash && (
            <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="flex items-start gap-3 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-900">
                <Fingerprint size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Genesis Certificate
                  </p>
                  <p className="text-[11px] font-mono text-emerald-500 break-all leading-relaxed">
                    {idea.genesisHash}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-1">
                    SHA-256 · Immutable timestamp proof of first publication
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-8 py-5 border-t border-slate-800 bg-slate-950/40
          flex items-center justify-between flex-wrap gap-4">

          {!(blurLevel === 3 && !isRevealed) && (
            <SparkButton
              ideaId={idea.id}
              viewerId={viewerId}
              initialLikes={idea.totalLikes ?? 0}
              onSuccess={() => setIsRevealed(true)}
            />
          )}

          <div className="flex items-center gap-3 ml-auto">
            {isOwner && (
              <Link
                href={`/idea/${idea.id}/edit`}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2
                  rounded-xl border border-slate-700 text-slate-400 hover:text-white
                  hover:border-slate-500 transition-colors"
              >
                <PenLine size={12} />
                Edit Idea
              </Link>
            )}
            {isOwner && (
              <Link
                href={`/idea/${idea.id}/manage`}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2
                  rounded-xl bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20
                  hover:bg-[#0d9488]/20 transition-colors"
              >
                <GitBranch size={12} />
                Manage
              </Link>
            )}
          </div>
        </div>
      </article>

      {/* ── COMMENTS SECTION ───────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl px-8 py-8">
        <CommentsSection
          ideaId={idea.id}
          viewerId={viewerId}
          initialComments={initialComments}
        />
      </div>

    </div>
  );
}
