"use client";

import { useState, useTransition, useRef } from "react";
import { Trash2, MessageCircle, Send } from "lucide-react";
import { addComment, deleteComment } from "@/app/actions/commentActions";
import Link from "next/link";

interface CommentUser {
  id: string | null;
  name: string | null;
  handle: string | null;
  image: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: Date | null;
  user: CommentUser;
}

interface CommentsSectionProps {
  ideaId: string;
  viewerId: string;
  initialComments: Comment[];
  viewerName?: string | null;
  viewerHandle?: string | null;
  viewerImage?: string | null;
  onCountChange?: (count: number) => void;
}

function relativeTime(date: Date | null): string {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CommentsSection({
  ideaId,
  viewerId,
  initialComments,
  viewerName = null,
  viewerHandle = null,
  viewerImage = null,
  onCountChange,
}: CommentsSectionProps) {
  const [commentList, setCommentList] = useState<Comment[]>(initialComments);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateList = (updater: (prev: Comment[]) => Comment[]) => {
    setCommentList((prev) => {
      const next = updater(prev);
      onCountChange?.(next.length);
      return next;
    });
  };

  async function handleAdd() {
    if (!text.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await addComment(ideaId, text);
      if (result.success) {
        setText("");
        const tempComment: Comment = {
          id: `temp-${Date.now()}`,
          content: text.trim(),
          createdAt: new Date(),
          user: {
            id: viewerId,
            name: viewerName,
            handle: viewerHandle,
            image: viewerImage,
          },
        };
        updateList((prev) => [tempComment, ...prev]);
      } else {
        setError(result.error ?? "Failed to post comment");
      }
    });
  }

  async function handleDelete(commentId: string) {
    startTransition(async () => {
      const result = await deleteComment(commentId, ideaId);
      if (result.success) {
        updateList((prev) => prev.filter((c) => c.id !== commentId));
      }
    });
  }

  return (
    <section className="mt-10 pt-8 border-t border-slate-800">
      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <MessageCircle size={18} className="text-[#0d9488]" />
        {commentList.length} Comment{commentList.length !== 1 ? "s" : ""}
      </h3>

      <div className="flex gap-3 mb-8">
        <div className="w-8 h-8 rounded-full bg-[#0d9488]/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[#0d9488] text-xs font-bold">
            {viewerHandle?.[0]?.toUpperCase() ?? viewerName?.[0]?.toUpperCase() ?? "U"}
          </span>
        </div>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts on this idea..."
            maxLength={1000}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900
              text-white text-sm resize-none focus:outline-none focus:ring-2
              focus:ring-[#0d9488]/40 focus:border-[#0d9488]
              placeholder:text-slate-500 transition"
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">{text.length}/1000</span>
            <button
              onClick={handleAdd}
              disabled={isPending || !text.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0d9488]
                text-white text-xs font-bold hover:bg-teal-600
                disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Send size={12} />
              {isPending ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {commentList.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">
            No comments yet. Be the first to spark a conversation!
          </p>
        )}
        {commentList.map((comment) => {
          const isOwn = comment.user.id === viewerId;
          const displayName = comment.user.handle ?? comment.user.name ?? "Anonymous";
          const initial = displayName[0].toUpperCase();

          return (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-teal-300
                flex items-center justify-center shrink-0 mt-0.5 text-white text-xs font-bold">
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {comment.user.handle ? (
                    <Link
                      href={`/profile/${comment.user.handle}`}
                      className="text-sm font-bold text-white hover:text-[#0d9488] transition-colors"
                    >
                      @{displayName}
                    </Link>
                  ) : (
                    <span className="text-sm font-bold text-white">@{displayName}</span>
                  )}
                  <span className="text-xs text-slate-500">{relativeTime(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>

              {isOwn && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400
                    hover:bg-red-900/20 transition-colors shrink-0 self-start mt-0.5"
                  title="Delete comment"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
