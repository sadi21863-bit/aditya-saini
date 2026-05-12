"use client";

import { useState } from "react";
import { Eye, Calendar, PenLine, MessageCircle, FlaskConical } from "lucide-react";
import SparkButton from "@/components/SparkButton";
import type { Idea, User } from "@/db/schema";
import Link from "next/link";

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

  return (
    <div className="space-y-6">
      <article className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl overflow-hidden">
        <div className="h-1 w-full bg-linear-to-r from-[#0d9488] via-teal-400 to-violet-500" />

        <div className="px-8 pt-8 pb-6">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 uppercase tracking-wider">
              {idea.category ?? "General"}
            </span>

            {isAiLabIdea && (
              <Link
                href="/ai-lab"
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-teal-900/40 text-teal-400 border border-teal-800 hover:border-teal-600 transition-colors"
              >
                <FlaskConical size={11} className="inline mr-1" />AI Lab
              </Link>
            )}

            {roomName && !isAiLabIdea && (
              <Link
                href={idea.roomId ? `/rooms/${idea.roomId}` : "#"}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-teal-700 transition-colors"
              >
                {roomName}
              </Link>
            )}

            <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
              <Calendar size={11} />
              {idea.createdAt
                ? new Date(idea.createdAt).toLocaleDateString("en-IN", {
                    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata",
                  })
                : ""}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-5 tracking-tight">
            {idea.title}
          </h1>

          {idea.context && (
            <p className="text-lg text-[#0d9488] italic font-medium mb-6 pb-6 border-b border-gray-200 dark:border-slate-800 leading-relaxed">
              &quot;{idea.context}&quot;
            </p>
          )}

          {author && (
            <div className="flex items-center gap-3 py-4 border-b border-gray-200/60 dark:border-slate-800/60">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-teal-900 border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center text-white font-bold text-sm shadow shrink-0">
                {author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={author.avatarUrl} alt={author.handle ?? ""} className="w-full h-full object-cover" />
                ) : (
                  (author.name ?? author.id)[0].toUpperCase()
                )}
              </div>
              <div>
                {author.isAi ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      @{author.handle ?? author.name ?? "Unknown"}
                    </span>
                    <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded-full">AI</span>
                  </div>
                ) : (
                  <Link
                    href={`/profile/${author.handle ?? author.id}`}
                    className="text-sm font-bold text-gray-900 dark:text-white hover:text-[#0d9488] transition-colors"
                  >
                    @{author.handle ?? author.name ?? "Unknown"}
                  </Link>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{author.name ?? "Anonymous"}</p>
              </div>

              <div className="ml-auto flex items-center gap-4 text-xs text-gray-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5"><Eye size={12} />{idea.views ?? 0} views</span>
                <span className="flex items-center gap-1.5"><MessageCircle size={12} />{commentCount} comments</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          <div className="mt-2">
            <p className="text-gray-600 dark:text-slate-300 leading-relaxed text-base whitespace-pre-wrap">
              {idea.content ?? ""}
            </p>
          </div>

          {/* Tags */}
          {idea.tags && idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-slate-800">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-8 py-5 border-t border-gray-200 dark:border-slate-800 bg-gray-50/40 dark:bg-slate-950/40 flex items-center justify-between flex-wrap gap-4">
          {!isOwner && (
            <SparkButton
              ideaId={idea.id}
              viewerId={viewerId}
              initialLikes={idea.totalLikes ?? 0}
              initialHasLiked={hasLiked}
            />
          )}

          <div className="flex items-center gap-3 ml-auto">
            {isOwner && (
              <Link
                href={`/idea/${idea.id}/edit`}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
              >
                <PenLine size={12} /> Edit Idea
              </Link>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
