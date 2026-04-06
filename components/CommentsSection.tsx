"use client";

import { useState, useTransition } from "react";
import { Trash2, MessageCircle, Send, CornerDownRight, Pencil, X, Check } from "lucide-react";
import { addComment, deleteComment, updateComment } from "@/app/actions/commentActions";
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
  updatedAt: Date | null;
  parentId: string | null;
  user: CommentUser;
}

interface CommentsSectionProps {
  ideaId: string;
  ideaOwnerId?: string;
  viewerId: string;
  initialComments: Comment[];
  viewerName?: string | null;
  viewerHandle?: string | null;
  viewerImage?: string | null;
  onCountChange?: (count: number) => void;
}

const COLLAPSE_AFTER = 3;

function relativeTime(date: Date | null): string {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function wasEdited(c: Comment) {
  if (!c.updatedAt || !c.createdAt) return false;
  return new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 2000;
}

export default function CommentsSection({
  ideaId,
  ideaOwnerId,
  viewerId,
  initialComments,
  viewerName = null,
  viewerHandle = null,
  viewerImage = null,
  onCountChange,
}: CommentsSectionProps) {
  const [commentList, setCommentList] = useState<Comment[]>(initialComments);
  const [text, setText] = useState("");
  const [topError, setTopError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const updateList = (fn: (prev: Comment[]) => Comment[]) =>
    setCommentList((prev) => {
      const next = fn(prev);
      onCountChange?.(next.length);
      return next;
    });

  const makeTemp = (content: string, parentId: string | null): Comment => ({
    id: `temp-${Date.now()}`,
    content,
    createdAt: new Date(),
    updatedAt: null,
    parentId,
    user: { id: viewerId, name: viewerName, handle: viewerHandle, image: viewerImage },
  });

  function handleAdd() {
    if (!text.trim()) return;
    setTopError("");
    startTransition(async () => {
      const res = await addComment(ideaId, text);
      if (res.success) {
        updateList((prev) => [makeTemp(text.trim(), null), ...prev]);
        setText("");
      } else {
        setTopError(res.error ?? "Failed to post");
      }
    });
  }

  function handleReply(parentId: string) {
    const content = replyTexts[parentId]?.trim();
    if (!content) return;
    startTransition(async () => {
      const res = await addComment(ideaId, content, parentId);
      if (res.success) {
        updateList((prev) => [...prev, makeTemp(content, parentId)]);
        setReplyTexts((p) => ({ ...p, [parentId]: "" }));
        setReplyingTo(null);
        setExpanded((p) => new Set([...p, parentId]));
      }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      const res = await deleteComment(commentId, ideaId);
      if (res.success) {
        updateList((prev) =>
          prev.filter((c) => c.id !== commentId && c.parentId !== commentId)
        );
      }
    });
  }

  function handleEdit(commentId: string) {
    if (!editText.trim()) return;
    startTransition(async () => {
      const res = await updateComment(commentId, ideaId, editText);
      if (res.success) {
        updateList((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, content: editText.trim(), updatedAt: new Date() }
              : c
          )
        );
        setEditingId(null);
      }
    });
  }

  const topLevel   = commentList.filter((c) => !c.parentId);
  const repliesFor = (id: string) => commentList.filter((c) => c.parentId === id);

  // ── Single comment row (used for both top-level and replies) ──────
  function CommentRow({ c, isReply }: { c: Comment; isReply: boolean }) {
    const isOwn = c.user.id === viewerId;
    const isOP  = !!ideaOwnerId && c.user.id === ideaOwnerId;
    const name  = c.user.handle ?? c.user.name ?? "Anonymous";
    const init  = name[0].toUpperCase();

    return (
      <div className="flex gap-3">
        <div className={`${isReply ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"} rounded-full
          bg-linear-to-br from-[#0d9488] to-teal-300 flex items-center justify-center
          shrink-0 mt-0.5 text-white font-bold`}>
          {init}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {c.user.handle ? (
              <Link href={`/profile/${c.user.handle}`}
                className="text-sm font-bold text-white hover:text-[#0d9488] transition-colors">
                @{name}
              </Link>
            ) : (
              <span className="text-sm font-bold text-white">@{name}</span>
            )}
            {isOP && (
              <span className="text-[10px] font-bold bg-[#0d9488]/20 text-[#0d9488]
                px-1.5 py-0.5 rounded">
                OP
              </span>
            )}
            <span className="text-xs text-slate-500">{relativeTime(c.createdAt)}</span>
            {wasEdited(c) && (
              <span className="text-[10px] italic text-slate-600">edited</span>
            )}
          </div>

          {editingId === c.id ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800
                  text-white text-sm resize-none focus:outline-none focus:border-[#0d9488] transition"
              />
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => handleEdit(c.id)} disabled={isPending}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#0d9488]
                    text-white text-xs font-bold hover:bg-teal-600 disabled:opacity-50 transition">
                  <Check size={11} /> Save
                </button>
                <button onClick={() => setEditingId(null)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700
                    text-slate-300 text-xs hover:bg-slate-600 transition">
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">
              {c.content}
            </p>
          )}

          {!isReply && editingId !== c.id && (
            <button
              onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
              className="flex items-center gap-1 mt-1.5 text-xs text-slate-500
                hover:text-[#0d9488] transition-colors">
              <CornerDownRight size={11} /> Reply
            </button>
          )}
        </div>

        {isOwn && editingId !== c.id && (
          <div className="flex gap-1 shrink-0 self-start mt-0.5">
            <button
              onClick={() => { setEditingId(c.id); setEditText(c.content); }}
              disabled={isPending} title="Edit"
              className="p-1.5 rounded-lg text-slate-600 hover:text-[#0d9488]
                hover:bg-[#0d9488]/10 transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={() => handleDelete(c.id)} disabled={isPending} title="Delete"
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400
                hover:bg-red-900/20 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="mt-10 pt-8 border-t border-slate-800">
      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <MessageCircle size={18} className="text-[#0d9488]" />
        {commentList.length} Comment{commentList.length !== 1 ? "s" : ""}
      </h3>

      {/* Top-level compose */}
      <div className="flex gap-3 mb-8">
        <div className="w-8 h-8 rounded-full bg-[#0d9488]/20 flex items-center justify-center
          shrink-0 mt-0.5">
          <span className="text-[#0d9488] text-xs font-bold">
            {viewerHandle?.[0]?.toUpperCase() ?? viewerName?.[0]?.toUpperCase() ?? "U"}
          </span>
        </div>
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts on this idea..."
            maxLength={1000}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900
              text-white text-sm resize-none focus:outline-none focus:ring-2
              focus:ring-[#0d9488]/40 focus:border-[#0d9488] placeholder:text-slate-500 transition"
          />
          {topError && <p className="text-red-400 text-xs mt-1">{topError}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">{text.length}/1000</span>
            <button onClick={handleAdd} disabled={isPending || !text.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0d9488] text-white
                text-xs font-bold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
              <Send size={12} />
              {isPending ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>

      {/* Comment list */}
      <div className="flex flex-col gap-6">
        {topLevel.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">
            No comments yet. Be the first to spark a conversation!
          </p>
        )}

        {topLevel.map((comment) => {
          const replies     = repliesFor(comment.id);
          const isExpanded  = expanded.has(comment.id);
          const visible     = isExpanded ? replies : replies.slice(0, COLLAPSE_AFTER);
          const hiddenCount = replies.length - COLLAPSE_AFTER;
          const displayName = comment.user.handle ?? comment.user.name ?? "Anonymous";

          return (
            <div key={comment.id}>
              <CommentRow c={comment} isReply={false} />

              {/* Inline reply input */}
              {replyingTo === comment.id && (
                <div className="ml-11 mt-3">
                  <p className="text-xs text-slate-500 mb-1.5">
                    Replying to{" "}
                    <span className="text-[#0d9488] font-medium">@{displayName}</span>
                  </p>
                  <textarea
                    value={replyTexts[comment.id] ?? ""}
                    onChange={(e) =>
                      setReplyTexts((p) => ({ ...p, [comment.id]: e.target.value }))
                    }
                    placeholder="Write a reply..."
                    maxLength={1000}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800
                      text-white text-sm resize-none focus:outline-none focus:border-[#0d9488] transition"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => handleReply(comment.id)}
                      disabled={isPending || !replyTexts[comment.id]?.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0d9488]
                        text-white text-xs font-bold hover:bg-teal-600 disabled:opacity-50 transition">
                      <Send size={11} /> Reply
                    </button>
                    <button onClick={() => setReplyingTo(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300
                        text-xs hover:bg-slate-600 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Nested replies */}
              {replies.length > 0 && (
                <div className="ml-11 mt-3 border-l-2 border-slate-700/60 pl-4 flex flex-col gap-4">
                  {visible.map((reply) => (
                    <CommentRow key={reply.id} c={reply} isReply />
                  ))}
                  {!isExpanded && hiddenCount > 0 && (
                    <button
                      onClick={() => setExpanded((p) => new Set([...p, comment.id]))}
                      className="text-xs text-[#0d9488] hover:underline self-start">
                      Show {hiddenCount} more{" "}
                      {hiddenCount === 1 ? "reply" : "replies"}
                    </button>
                  )}
                  {isExpanded && replies.length > COLLAPSE_AFTER && (
                    <button
                      onClick={() =>
                        setExpanded((p) => {
                          const s = new Set(p);
                          s.delete(comment.id);
                          return s;
                        })
                      }
                      className="text-xs text-slate-500 hover:text-slate-300 self-start">
                      Collapse replies
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
