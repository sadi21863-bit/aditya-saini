"use client";

import { useState } from "react";
import { Eye, MessageCircle, FlaskConical, PenLine } from "lucide-react";
import SparkButton from "@/components/SparkButton";
import type { Idea, User } from "@/db/schema";
import Link from "next/link";
import { catClass } from "@/lib/categories";

interface IdeaDetailClientProps {
  idea: Idea;
  author: User | null;
  viewerId: string;
  hasLiked: boolean;
  isOwner: boolean;
  roomName?: string | null;
  isAiLabIdea?: boolean;
}

export default function IdeaDetailClient({
  idea, author, viewerId, hasLiked, isOwner, roomName, isAiLabIdea,
}: IdeaDetailClientProps) {
  const [commentCount] = useState(idea.totalComments ?? 0);

  const categoryClass = catClass(idea.category);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 md:gap-14 items-start">

        {/* ── Left column — content ── */}
        <article>
          {/* Category + room badge */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className={`${categoryClass} font-mono text-[10px] font-medium px-2 py-1 rounded-sm`}>
              {idea.category ?? "General"}
            </span>

            {isAiLabIdea ? (
              <Link
                href="/ai-lab"
                className="font-mono text-[11px] text-ic-muted hover:text-ic-ink transition-colors inline-flex items-center gap-1"
              >
                <FlaskConical size={11} /> AI Lab
              </Link>
            ) : roomName ? (
              <Link
                href={idea.roomId ? `/rooms/${idea.roomId}` : "#"}
                className="font-mono text-[11px] text-ic-muted hover:text-ic-ink transition-colors"
              >
                #{roomName}
              </Link>
            ) : null}
          </div>

          {/* Title */}
          <h1 className="font-display text-[52px] leading-[1.05] tracking-[-0.02em] font-normal text-ic-ink mb-5">
            {idea.title}
          </h1>

          {/* Pitch */}
          {idea.context && (
            <p className="font-display italic text-xl text-ic-muted leading-relaxed mb-6">
              &ldquo;{idea.context}&rdquo;
            </p>
          )}

          <div className="border-t border-ic-rule my-6" />

          {/* Author row */}
          {author && (
            <div className="font-mono text-[12px] text-ic-muted flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded overflow-hidden bg-ic-paper-deep border border-ic-rule flex items-center justify-center text-ic-ink font-bold text-xs shrink-0">
                {author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={author.avatarUrl} alt={author.handle ?? ""} className="w-full h-full object-cover" />
                ) : (
                  (author.name ?? author.id)[0].toUpperCase()
                )}
              </div>
              {author.isAi ? (
                <span className="text-ic-ink font-semibold">
                  @{author.handle ?? author.name ?? "Unknown"}
                  <span className="ml-1.5 font-mono text-[9px] bg-ic-accent text-white px-1.5 py-0.5 rounded-full">AI</span>
                </span>
              ) : (
                <Link
                  href={`/profile/${author.handle ?? author.id}`}
                  className="text-ic-ink font-semibold hover:text-ic-accent transition-colors"
                >
                  @{author.handle ?? author.name ?? "Unknown"}
                </Link>
              )}
              <span>·</span>
              <span>{author.name ?? "Anonymous"}</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1"><Eye size={11} />{idea.views ?? 0} views</span>
                <span className="flex items-center gap-1"><MessageCircle size={11} />{commentCount} comments</span>
              </span>
            </div>
          )}

          {/* Body */}
          <p className="font-sans text-base text-ic-ink leading-relaxed whitespace-pre-wrap">
            {idea.content ?? ""}
          </p>

          {/* Tags */}
          {idea.tags && idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-ic-rule">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[11px] px-2.5 py-1 rounded-sm bg-ic-paper-deep border border-ic-rule text-ic-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* ── Right column — sticky actions (desktop) ── */}
        <aside className="hidden md:flex flex-col gap-3 sticky top-6">
          <div className="bg-ic-card border border-ic-rule rounded-2xl p-5">
            {!isOwner && (
              <SparkButton
                ideaId={idea.id}
                initialLikes={idea.totalLikes ?? 0}
                initialHasLiked={hasLiked}
              />
            )}

            <div className="flex items-center gap-4 font-mono text-[11px] text-ic-muted mt-4 pt-4 border-t border-ic-rule-soft">
              <span className="flex items-center gap-1.5"><Eye size={12} />{idea.views ?? 0} views</span>
              <span className="flex items-center gap-1.5"><MessageCircle size={12} />{commentCount} replies</span>
            </div>

            {isOwner && (
              <div className="mt-4 pt-4 border-t border-ic-rule-soft flex flex-col gap-2">
                <p className="font-mono text-[10px] text-ic-muted uppercase tracking-widest mb-1">Author actions</p>
                <Link
                  href={`/idea/${idea.id}/edit`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-accent hover:text-ic-ink text-sm transition-colors"
                >
                  <PenLine size={13} /> Edit idea
                </Link>
              </div>
            )}
          </div>

          {isAiLabIdea && (
            <div className="bg-[#1A1814] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-ic-accent-bright animate-pulse" />
                <span className="font-mono text-[10px] text-[rgba(244,241,234,0.55)] uppercase tracking-widest">
                  Discussed in AI Lab
                </span>
              </div>
              <p className="font-display italic text-[15px] text-[#F4F1EA] leading-snug mb-3">
                {idea.title}
              </p>
              <Link href="/ai-lab" className="font-mono text-[11px] text-ic-accent-bright font-medium hover:opacity-80 transition">
                Read thread →
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* ── Mobile sticky actions bar ── */}
      <div className="fixed bottom-14 left-0 right-0 bg-ic-card border-t border-ic-rule px-4 py-3 flex items-center justify-between gap-3 md:hidden z-30">
        {!isOwner ? (
          <SparkButton
            ideaId={idea.id}
            initialLikes={idea.totalLikes ?? 0}
            initialHasLiked={hasLiked}
          />
        ) : (
          <Link
            href={`/idea/${idea.id}/edit`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-ic-rule text-ic-muted hover:border-ic-accent text-sm transition-colors"
          >
            <PenLine size={13} /> Edit
          </Link>
        )}
        <div className="font-mono text-[11px] text-ic-muted flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1"><Eye size={11} />{idea.views ?? 0}</span>
          <span className="flex items-center gap-1"><MessageCircle size={11} />{commentCount}</span>
        </div>
      </div>
    </>
  );
}
