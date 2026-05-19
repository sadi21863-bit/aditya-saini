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
  id:               string;
  date:             string | Date;
  theme:            string;
  status:           string;
  flaggedReason:    string | null;
  narrativeArc:     string | null;
  keyDisagreements: unknown;
  memorableQuotes:  unknown;
  publishedAt:      Date | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  flagged:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  published: "bg-ic-accent/10 text-ic-accent",
  rejected:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const RESOLUTION_STYLES: Record<string, string> = {
  unresolved:    "bg-ic-paper-deep text-ic-muted border border-ic-rule",
  converged:     "bg-ic-accent/10 text-ic-accent border border-ic-accent/20",
  one_persuaded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function ArchiveModerationPanel({
  needsReview,
  recentlyPublished,
}: {
  needsReview:       ArchiveRow[];
  recentlyPublished: ArchiveRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [narrativeVal, setNarrativeVal] = useState("");
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [feedback,     setFeedback]     = useState<Record<string, string>>({});
  const [dismissed,    setDismissed]    = useState<Set<string>>(new Set());

  function setMsg(id: string, msg: string) {
    setFeedback((prev) => ({ ...prev, [id]: msg }));
    setTimeout(() => setFeedback((prev) => { const n = { ...prev }; delete n[id]; return n; }), 4000);
  }

  function run(fn: () => Promise<{ success: boolean; error?: string; message?: string }>, archiveId: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        setDismissed((prev) => new Set(prev).add(archiveId));
        setEditingId(null);
        setRejectingId(null);
        router.refresh();
      } else {
        setMsg(archiveId, result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── Needs Review ── */}
      <section>
        <h2 className="font-display text-xl text-ic-ink mb-5">Needs Review</h2>

        {needsReview.filter((a) => !dismissed.has(a.id)).length === 0 ? (
          <p className="font-mono text-[12px] text-ic-muted py-10 text-center">
            All caught up — no archives need review.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {needsReview.filter((a) => !dismissed.has(a.id)).map((archive) => {
              const disagreements = (Array.isArray(archive.keyDisagreements) ? archive.keyDisagreements : []) as Array<Record<string, unknown>>;
              const quotes        = (Array.isArray(archive.memorableQuotes)  ? archive.memorableQuotes  : []) as Array<Record<string, unknown>>;
              const isEditing     = editingId   === archive.id;
              const isRejecting   = rejectingId === archive.id;
              const msg           = feedback[archive.id];

              return (
                <div key={archive.id} className="bg-ic-paper-deep border border-ic-rule rounded-2xl p-6">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="font-mono text-[11px] text-ic-muted">
                      {String(archive.date).slice(0, 10)}
                    </span>
                    <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${STATUS_BADGE[archive.status] ?? STATUS_BADGE.draft}`}>
                      {archive.status}
                    </span>
                    <h3 className="font-display text-lg text-ic-ink">{archive.theme}</h3>
                  </div>

                  {archive.flaggedReason && (
                    <p className="font-mono text-[11px] text-amber-700 dark:text-amber-400 mb-4 bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      QC flag: {archive.flaggedReason}
                    </p>
                  )}

                  {/* Narrative arc */}
                  {archive.narrativeArc && (
                    <div className="mb-4">
                      <p className="font-mono text-[10px] text-ic-muted uppercase tracking-widest mb-2">
                        Narrative
                      </p>
                      <article className="text-ic-ink leading-relaxed space-y-4
                        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ic-accent [&_h2]:mt-4 [&_h2]:mb-1
                        [&_strong]:text-ic-ink [&_em]:text-ic-ink-soft [&_p]:text-ic-ink-soft
                        border border-ic-rule rounded-xl p-4 bg-ic-paper-deep">
                        <ReactMarkdown>{archive.narrativeArc}</ReactMarkdown>
                      </article>
                    </div>
                  )}

                  {/* Key disagreements */}
                  {disagreements.length > 0 && (
                    <div className="mb-4">
                      <p className="font-mono text-[10px] text-ic-muted uppercase tracking-widest mb-2">
                        Key Disagreements
                      </p>
                      <div className="flex flex-col gap-2">
                        {disagreements.map((d, i) => {
                          const between    = (Array.isArray(d.between) ? d.between : []) as string[];
                          const resolution = String(d.resolution ?? "unresolved");
                          return (
                            <div key={i} className="bg-ic-paper border border-ic-rule rounded-lg p-3">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {between.map((h, j) => (
                                  <span key={h} className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                                    j === 0
                                      ? "bg-ic-paper-deep border border-ic-rule text-ic-accent"
                                      : "bg-ic-paper-deep border border-ic-rule text-ic-muted"
                                  }`}>
                                    @{h}
                                  </span>
                                ))}
                                <span className={`ml-auto font-mono text-[9px] uppercase px-2 py-0.5 rounded ${RESOLUTION_STYLES[resolution] ?? RESOLUTION_STYLES.unresolved}`}>
                                  {resolution.replace("_", " ")}
                                </span>
                              </div>
                              <p className="text-ic-ink-soft text-sm">{String(d.topic ?? "")}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Memorable quotes */}
                  {quotes.length > 0 && (
                    <div className="mb-4">
                      <p className="font-mono text-[10px] text-ic-muted uppercase tracking-widest mb-2">
                        Memorable Quotes
                      </p>
                      <div className="flex flex-col gap-3">
                        {quotes.map((q, i) => (
                          <blockquote key={i} className="border-l-2 border-ic-accent pl-3">
                            <p className="text-ic-ink text-sm">{String(q.text ?? "")}</p>
                            <footer className="font-mono text-[11px] text-ic-accent mt-1">
                              — @{String(q.agent ?? "")}
                            </footer>
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
                        className="w-full bg-ic-paper border border-ic-accent rounded-xl p-3 text-ic-ink text-sm resize-y focus:outline-none font-sans"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => run(() => editArchiveNarrative(archive.id, narrativeVal), archive.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-ic-accent hover:opacity-90 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-ic-rule text-ic-muted hover:border-ic-accent hover:text-ic-ink text-xs font-medium rounded-lg transition"
                        >
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
                        className="w-full bg-ic-paper border border-red-400 rounded-xl px-3 py-2 text-ic-ink text-sm focus:outline-none font-sans"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => run(() => rejectArchive(archive.id, rejectReason), archive.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                        >
                          {isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-ic-rule text-ic-muted hover:border-ic-accent hover:text-ic-ink text-xs font-medium rounded-lg transition"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback message */}
                  {msg && (
                    <p className="font-mono text-[12px] text-ic-accent mb-3">{msg}</p>
                  )}

                  {/* Action buttons */}
                  {!isEditing && !isRejecting && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-ic-rule">
                      <button
                        onClick={() => run(() => approveArchive(archive.id), archive.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        onClick={() => { setEditingId(archive.id); setNarrativeVal(archive.narrativeArc ?? ""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-ic-rule text-ic-muted hover:border-ic-accent hover:text-ic-ink text-xs font-medium rounded-lg transition"
                      >
                        <Edit3 size={12} /> Edit Narrative
                      </button>
                      <button
                        onClick={() => run(() => regenerateArchive(archive.id), archive.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-ic-rule text-ic-muted hover:border-ic-accent hover:text-ic-ink text-xs font-medium rounded-lg transition disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
                      </button>
                      <button
                        onClick={() => { setRejectingId(archive.id); setRejectReason(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium rounded-lg transition"
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

      {/* ── Recently Published ── */}
      <section>
        <h2 className="font-display text-xl text-ic-ink mb-5">Recently Published</h2>
        {recentlyPublished.length === 0 ? (
          <p className="font-mono text-[12px] text-ic-muted">No published archives yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentlyPublished.map((archive) => (
              <div key={archive.id} className="flex items-center justify-between bg-ic-card border border-ic-rule rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ic-muted">
                    {String(archive.date).slice(0, 10)}
                  </span>
                  <span className="text-ic-ink text-sm font-medium">{archive.theme}</span>
                </div>
                {archive.publishedAt && (
                  <span className="font-mono text-[10px] text-ic-muted">
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
