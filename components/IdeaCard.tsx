'use client'

import Link from "next/link";
import { useState } from "react";
import { Rocket, Trash2, Edit3, Eye, Loader2, RotateCcw } from "lucide-react";
import { launchIdea, deleteIdea, recallIdea } from "@/app/actions/ideaActions";
import { ideas } from "@/db/schema";

type Idea = typeof ideas.$inferSelect;

interface IdeaCardProps {
  idea: Idea;
  /** Pass true when rendered inside the dashboard to show action buttons */
  showActions?: boolean;
}

export default function IdeaCard({ idea, showActions = false }: IdeaCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // Helper to run server actions with a loading state
  const run = async (key: string, action: (id: string) => Promise<void>) => {
    try {
      setLoading(key);
      await action(idea.id);
    } catch (error) {
      console.error(`Action ${key} failed:`, error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    public: "bg-teal-50  text-teal-700  border-teal-200",
  };

  return (
    <div className="group bg-white border border-slate-100 rounded-3xl p-6 hover:border-[#0d9488]/30 hover:shadow-lg transition-all duration-300 flex flex-col gap-4">

      {/* TOP ROW: Status and Date */}
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${statusColors[idea.status ?? "draft"] ?? statusColors.draft}`}>
          {idea.status === 'public' ? 'Live' : 'Archived'}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">
          {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
        </span>
      </div>

      {/* CONTENT: Category, Title, Hook */}
      <div>
        <span className="text-[10px] font-semibold text-[#0d9488] uppercase tracking-widest">
          {idea.category ?? "General"}
        </span>
        <h3 className="text-lg font-bold text-slate-900 leading-snug mt-1 group-hover:text-[#0d9488] transition-colors font-serif italic">
          {idea.title}
        </h3>
        {idea.hook && (
          <p className="text-sm text-slate-500 italic mt-1 line-clamp-2">"{idea.hook}"</p>
        )}
      </div>

      {/* FOOTER: Stats and Actions */}
      <div className="flex flex-col gap-4 mt-auto">
        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
          <span>⚡ {idea.totalLikes ?? 0} likes</span>
        </div>

        <div className="flex gap-2 pt-3 border-t border-slate-50">
          {/* Always Visible: View Link */}
          <Link
            href={`/idea/${idea.id}`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Eye size={13} /> View
          </Link>

          {showActions && (
            <>
              {/* Edit Link */}
              <Link
                href={`/idea/${idea.id}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Edit3 size={13} /> Edit
              </Link>

              {/* Toggle Logic: Launch or Recall */}
              {idea.status === "draft" ? (
                <button
                  onClick={() => run("launch", launchIdea)}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#0d9488] rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors ml-auto shadow-sm shadow-teal-100"
                >
                  {loading === "launch" ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
                  Launch
                </button>
              ) : (
                <button
                  onClick={() => run("recall", recallIdea)}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors ml-auto"
                >
                  {loading === "recall" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  Recall
                </button>
              )}

              {/* Permanent Delete */}
              <button
                onClick={() => {
                  if (confirm("Permanently delete this vision?")) {
                    run("delete", deleteIdea);
                  }
                }}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 bg-red-50 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {loading === "delete" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}