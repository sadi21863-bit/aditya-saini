"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { CheckCircle, Edit3, RefreshCw, XCircle, Loader2, Save, X } from "lucide-react";
import {
  approveArchive,
  editArchiveNarrative,
  regenerateArchive,
  rejectArchive,
} from "@/app/actions/ai-lab-admin-actions";

type ArchiveRow = {
  id:            string;
  date:          string | Date;
  theme:         string;
  status:        string;
  flaggedReason: string | null;
  narrativeArc:  string | null;
  keyDisagreements: unknown;
  memorableQuotes:  unknown;
  publishedAt:   Date | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft:    "bg-slate-700 text-slate-300",
  flagged:  "bg-amber-900/60 text-amber-300 border border-amber-700",
  published:"bg-green-900/60 text-green-300",
  rejected: "bg-red-900/60 text-red-300",
};

const RESOLUTION_STYLES: Record<string, string> = {
  unresolved:    "bg-amber-900/50 text-amber-300 border border-amber-700",
  converged:     "bg-green-900/50 text-green-300 border border-green-700",
  one_persuaded: "bg-blue-900/50 text-blue-300 border border-blue-700",
};

export default function ArchiveModerationPanel({
  needsReview,
  recentlyPublished,
}: {
  needsReview:       ArchiveRow[];
  recentlyPublished: ArchiveRow[];
}) {
  const router   = useRouter();
  const [isPending, startTransition] = useTransition();

  // Per-archive inline edit state
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [narrativeVal, setNarrativeVal] = useState("");
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [feedback,     setFeedback]     = useState<Record<string, string>>({});

  function setMsg(id: string, msg: string) {
    setFeedback((prev) => ({ ...prev, [id]: msg }));
    setTimeout(() => setFeedback((prev) => { const n = { ...prev }; delete n[id]; return n; }), 4000);
  }

  function run(fn: () => Promise<{ success: boolean; error?: string; message?: string }>, archiveId: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        setMsg(archiveId, result.message ?? "Done");
        router.refresh();
      } else {
        setMsg(archiveId, result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── Needs Review ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-5">Needs Review</h2>

        {needsReview.length === 0 ? (
          <p className="text-slate-500 py-10 text-center">
            All caught up — no archives need review.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {needsReview.map((archive) => {
              const disagreements = (Array.isArray(archive.keyDisagreements) ? archive.keyDisagreements : []) as Array<Record<string, unknown>>;
              const quotes        = (Array.isArray(archive.memorableQuotes)  ? archive.memorableQuotes  : []) as Array<Record<string, unknown>>;
              const isEditing     = editingId   === archive.id;
              const isRejecting   = rejectingId === archive.id;
              const msg           = feedback[archive.id];

              return (
                <div key={archive.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-slate-400 text-sm">{String(archive.date).slice(0, 10)}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_BADGE[archive.status] ?? STATUS_BADGE.draft}`}>
                      {archive.status}
                    </span>
                    <h3 className="text-white font-semibold text-lg">{archive.theme}</h3>
                  </div>

                  {archive.flaggedReason && (
                    <p className="text-amber-400 text-sm mb-4 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
                      QC flag: {archive.flaggedReason}
                    </p>
                  )}

                  {/* Narrative arc */}
                  {archive.narrativeArc && (
                    <div className="mb-4">
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Narrative</p>
                      <article className="text-slate-100 leading-relaxed space-y-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-teal-400 [&_h2]:mt-4 [&_h2]:mb-1 [&_strong]:text-white [&_em]:text-slate-300 [&_p]:text-slate-200 border border-slate-800 rounded-xl p-4 bg-slate-950">
                        <ReactMarkdown>{archive.narrativeArc}</ReactMarkdown>
                      </article>
                    </div>
                  )}

                  {/* Key disagreements */}
                  {disagreements.length > 0 && (
                    <div className="mb-4">
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Key Disagreements</p>
                      <div className="flex flex-col gap-2">
                        {disagreements.map((d, i) => {
                          const between    = (Array.isArray(d.between) ? d.between : []) as string[];
                          const resolution = String(d.resolution ?? "unresolved");
                          return (
                            <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {between.map((h, j) => (
                                  <span key={h} className={`px-2 py-0.5 rounded text-xs font-semibold ${j === 0 ? "bg-teal-900/60 text-teal-300" : "bg-slate-700 text-slate-300"}`}>
                                    @{h}
                                  </span>
                                ))}
                                <span className={`ml-auto px-2 py-0.5 rounded text-xs ${RESOLUTION_STYLES[resolution] ?? RESOLUTION_STYLES.unresolved}`}>
                                  {resolution.replace("_", " ")}
                                </span>
                              </div>
                              <p className="text-slate-300 text-sm">{String(d.topic ?? "")}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Memorable quotes */}
                  {quotes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Memorable Quotes</p>
                      <div className="flex flex-col gap-3">
                        {quotes.map((q, i) => (
                          <blockquote key={i} className="border-l-2 border-teal-600 pl-3">
                            <p className="text-slate-200 text-sm">{String(q.text ?? "")}</p>
                            <footer className="text-teal-400 text-xs mt-1">— @{String(q.agent ?? "")}</footer>
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline edit narrative */}
                  {isEditing && (
                    <div className="mb-4">
                      <textarea
                        value={narrativeVal}
                        onChange={(e) => setNarrativeVal(e.target.value)}
                        rows={12}
                        className="w-full bg-slate-950 border border-teal-600 rounded-xl p-3 text-slate-200 text-sm resize-y focus:outline-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => run(() => editArchiveNarrative(archive.id, narrativeVal), archive.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition">
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline reject */}
                  {isRejecting && (
                    <div className="mb-4">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Rejection reason…"
                        className="w-full bg-slate-950 border border-red-600 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => run(() => rejectArchive(archive.id, rejectReason), archive.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                        </button>
                        <button onClick={() => setRejectingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition">
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback message */}
                  {msg && (
                    <p className="text-sm text-teal-400 mb-3">{msg}</p>
                  )}

                  {/* Action buttons */}
                  {!isEditing && !isRejecting && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => run(() => approveArchive(archive.id), archive.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-800 hover:bg-green-700 text-green-200 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        onClick={() => { setEditingId(archive.id); setNarrativeVal(archive.narrativeArc ?? ""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition"
                      >
                        <Edit3 size={12} /> Edit Narrative
                      </button>
                      <button
                        onClick={() => run(() => regenerateArchive(archive.id), archive.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
                      </button>
                      <button
                        onClick={() => { setRejectingId(archive.id); setRejectReason(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/60 text-red-300 text-xs font-semibold rounded-lg border border-red-800 transition"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Recently Published ──────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-5">Recently Published</h2>
        {recentlyPublished.length === 0 ? (
          <p className="text-slate-500 text-sm">No published archives yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentlyPublished.map((archive) => (
              <div key={archive.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{String(archive.date).slice(0, 10)}</span>
                  <span className="text-white text-sm font-medium">{archive.theme}</span>
                </div>
                {archive.publishedAt && (
                  <span className="text-slate-500 text-xs">
                    Published {new Date(archive.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
