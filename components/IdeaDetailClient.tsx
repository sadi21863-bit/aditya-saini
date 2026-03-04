"use client";

/**
 * components/IdeaDetailClient.tsx
 *
 * Handles ALL client-side IP protection for the idea detail view:
 *
 *   Tier 0 (Open)      — plain text, no restrictions
 *   Tier 1 (Guarded)   — CSS user-select: none
 *   Tier 2 (Shielded)  — CSS + JS right-click / copy / select-all block
 *   Tier 3 (Vault)     — Tier 2 + Selective Blur on content beyond 150 chars
 *                        Blur lifts immediately when the user Sparks (likes) the idea
 *
 * The "Honest Hook Policy" is enforced unconditionally at every tier:
 *   → First 150 chars of content are ALWAYS rendered in clear text.
 *   → Only the remainder is subject to blur / protection.
 *
 * Props are passed down from the Server Component (app/idea/[id]/page.tsx)
 * so no client-side data fetching is needed here.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ShieldCheck, Shield, ShieldOff, Lock,
  Fingerprint, GitBranch, Eye, Zap,
} from "lucide-react";
import SparkButton from "@/components/SparkButton";
import type { Idea, User } from "@/db/schema";
import { getTierFromXp } from "@/lib/tier-engine";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────
const HONEST_HOOK_CHARS = 150; // Always revealed regardless of tier

// ─── Types ────────────────────────────────────────────────────────────────────
interface IdeaDetailClientProps {
  idea:         Idea;
  author:       User | null;
  viewerId:     string;
  hasLiked:     boolean;  // Server pre-checked: did this viewer already like it?
  isOwner:      boolean;  // Is the viewer the Genesis Creator?
  isContributor: boolean; // Is the viewer in contributor_ids[]?
}

// ─── Protection level badge config ────────────────────────────────────────────
const SHIELD_CONFIG = {
  0: { label: "Open",     Icon: ShieldOff,  textColor: "text-slate-500",  badgeCls: "bg-slate-100  border-slate-200"   },
  1: { label: "Guarded",  Icon: Shield,     textColor: "text-blue-700",   badgeCls: "bg-blue-50    border-blue-200"    },
  2: { label: "Shielded", Icon: ShieldCheck, textColor: "text-violet-700", badgeCls: "bg-violet-50  border-violet-200"  },
  3: { label: "Vault",    Icon: Lock,        textColor: "text-amber-700",  badgeCls: "bg-amber-50   border-amber-200"   },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function IdeaDetailClient({
  idea,
  author,
  viewerId,
  hasLiked,
  isOwner,
  isContributor,
}: IdeaDetailClientProps) {
  // Blur is lifted when: user already liked (server-confirmed) OR sparks now
  const [isRevealed, setIsRevealed] = useState(hasLiked || isOwner || isContributor);
  const contentRef = useRef<HTMLDivElement>(null);

  const blurLevel  = idea.blurLevel ?? 0;
  const shieldCfg  = SHIELD_CONFIG[blurLevel as keyof typeof SHIELD_CONFIG] ?? SHIELD_CONFIG[0];
  const ShieldIcon = shieldCfg.Icon;

  // ── "Honest Hook" split ──────────────────────────────────────────────────
  // Always clear: first 150 chars. Subject to blur: everything after.
  const fullContent = idea.content ?? "";
  const clearPart   = fullContent.slice(0, HONEST_HOOK_CHARS);
  const blurPart    = fullContent.slice(HONEST_HOOK_CHARS);
  const hasBlurPart = blurPart.length > 0;

  // ── Tier 2 & 3: JS-level copy / right-click protection ──────────────────
  const blockCopy = useCallback((e: ClipboardEvent) => {
    if (blurLevel >= 2) e.preventDefault();
  }, [blurLevel]);

  const blockContextMenu = useCallback((e: MouseEvent) => {
    if (blurLevel >= 2) e.preventDefault();
  }, [blurLevel]);

  const blockKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (blurLevel < 2) return;
    const isMod = e.ctrlKey || e.metaKey;
    // Block Ctrl/Cmd + A (select all), C (copy), X (cut)
    if (isMod && ["a", "c", "x"].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  }, [blurLevel]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || blurLevel < 2) return;

    el.addEventListener("copy",        blockCopy);
    el.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeyboardShortcuts);

    return () => {
      el.removeEventListener("copy",        blockCopy);
      el.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeyboardShortcuts);
    };
  }, [blurLevel, blockCopy, blockContextMenu, blockKeyboardShortcuts]);

  // ── Tier config: CSS classes for the content wrapper ────────────────────
  const contentWrapperCls = [
    // Tier 1+: disable text selection
    blurLevel >= 1 ? "select-none" : "",
    // Tier 2+: disable drag
    blurLevel >= 2 ? "pointer-events-none" : "",
  ].filter(Boolean).join(" ");

  // ── Author tier badge ────────────────────────────────────────────────────
  const authorTier = author ? getTierFromXp(author.xp ?? 0) : null;

  return (
    <article className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">

      {/* ══ HEADER BAND ════════════════════════════════════════════════════ */}
      <div className="px-10 pt-10 pb-6">

        {/* Category + Date + Shield badge */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0d9488]/10
            text-[#0d9488] border border-[#0d9488]/20 uppercase tracking-wider">
            {idea.category ?? "General"}
          </span>

          {/* Protection level badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
            rounded-full border uppercase tracking-wider
            ${shieldCfg.textColor} ${shieldCfg.badgeCls}`}>
            <ShieldIcon size={12} />
            {shieldCfg.label}
          </span>

          {/* Genesis sentinel — shown only when published */}
          {idea.genesisHash && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
              rounded-full border uppercase tracking-wider
              text-emerald-700 bg-emerald-50 border-emerald-200">
              <Fingerprint size={12} />
              Genesis Verified
            </span>
          )}

          {/* Contributor tag */}
          {isContributor && !isOwner && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5
              rounded-full border uppercase tracking-wider
              text-violet-700 bg-violet-50 border-violet-200">
              <GitBranch size={12} />
              Verified Contributor
            </span>
          )}

          <span className="text-xs text-slate-400 font-medium ml-auto">
            {idea.createdAt
              ? new Date(idea.createdAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })
              : ""}
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-bold text-slate-900 leading-tight mb-5 tracking-tight"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {idea.title}
        </h1>

        {/* Hook — always 100% clear regardless of tier */}
        {idea.hook && (
          <p className="text-xl text-[#0d9488] italic font-medium mb-6 pb-6 border-b border-slate-100 leading-relaxed">
            "{idea.hook}"
          </p>
        )}

        {/* Author row */}
        {author && (
          <div className="flex items-center gap-3 py-4 border-b border-slate-50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0d9488] to-teal-300
              flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow">
              {(author.name ?? author.id)[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${author.handle ?? author.id}`}
                  className="text-sm font-bold text-slate-900 hover:text-[#0d9488] transition-colors"
                >
                  @{author.handle ?? author.name ?? "Unknown"}
                </Link>
                {authorTier && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                    uppercase tracking-wider ${authorTier.color} ${authorTier.bg}`}>
                    {authorTier.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Genesis Creator</p>
            </div>

            {/* Contributors count */}
            {(idea.contributorIds?.length ?? 0) > 0 && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-violet-600 font-semibold">
                <GitBranch size={13} />
                {idea.contributorIds!.length} Contributor
                {idea.contributorIds!.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ CONTENT BODY ═══════════════════════════════════════════════════ */}
      <div className="px-10 pb-10" ref={contentRef}>

        {/* ── Clear portion: always visible (Honest Hook Policy) ─────────── */}
        <div className={`mt-4 ${contentWrapperCls}`}>
          <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
            {clearPart}
            {/* Inline fade indicator when blurred content follows */}
            {hasBlurPart && !isRevealed && blurLevel === 3 && (
              <span className="text-slate-300 select-none">…</span>
            )}
          </p>
        </div>

        {/* ── Blurred portion (Tier 3 only, with Like-to-Reveal gate) ─────── */}
        {hasBlurPart && blurLevel === 3 && (
          <div className="relative mt-4">
            {/* The blurred text — always in the DOM so layout is stable */}
            <div
              className={`transition-all duration-700 ease-in-out ${
                isRevealed
                  ? "blur-none"
                  : "blur-md pointer-events-none select-none"
              } ${contentWrapperCls}`}
              aria-hidden={!isRevealed}
            >
              <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
                {blurPart}
              </p>
            </div>

            {/* Overlay CTA — only shown when content is still blurred */}
            {!isRevealed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center
                bg-gradient-to-t from-white via-white/80 to-transparent rounded-2xl
                min-h-[120px] gap-4 pointer-events-auto">

                <div className="flex flex-col items-center gap-2 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#0d9488]/10 flex items-center
                    justify-center mb-1">
                    <Zap size={22} className="text-[#0d9488]" />
                  </div>
                  <p className="text-slate-900 font-bold text-sm">
                    Like to reveal the full idea
                  </p>
                  <p className="text-slate-400 text-xs max-w-xs">
                    Spark this idea to unlock the complete vision from the Genesis Creator.
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

        {/* ── Tiers 0–2: show full content (protection is CSS/JS only) ─────── */}
        {blurLevel < 3 && hasBlurPart && (
          <div className={`mt-4 ${contentWrapperCls}`}>
            <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
              {blurPart}
            </p>
          </div>
        )}

        {/* ── Genesis Hash display strip ────────────────────────────────────── */}
        {idea.genesisHash && (
          <div className="mt-10 pt-6 border-t border-slate-50">
            <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl
              border border-emerald-100">
              <Fingerprint size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  Genesis Certificate
                </p>
                <p className="text-[11px] font-mono text-emerald-600 break-all leading-relaxed">
                  {idea.genesisHash}
                </p>
                <p className="text-[10px] text-emerald-500 mt-1">
                  SHA-256 · Immutable timestamp proof of first publication
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ FOOTER ═════════════════════════════════════════════════════════ */}
      <div className="px-10 py-6 border-t border-slate-100 bg-slate-50/40
        flex items-center justify-between flex-wrap gap-4">

        {/* SparkButton — hidden when Tier 3 and not yet revealed (CTA above handles it) */}
        {!(blurLevel === 3 && !isRevealed) && (
          <SparkButton
            ideaId={idea.id}
            viewerId={viewerId}
            initialLikes={idea.totalLikes ?? 0}
            onSuccess={() => setIsRevealed(true)}
          />
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Eye size={13} />
            {idea.views ?? 0} views
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={13} />
            {idea.totalLikes ?? 0} sparks
          </span>
        </div>

        {/* Owner-only edit link */}
        {isOwner && (
          <Link
            href={`/idea/${idea.id}/edit`}
            className="text-xs font-bold text-slate-400 hover:text-[#0d9488]
              uppercase tracking-widest transition-colors"
          >
            Edit Idea →
          </Link>
        )}
      </div>
    </article>
  );
}
