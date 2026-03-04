import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Sparkles, FileText, Rocket, AlertCircle, CheckCircle2, Clock } from "lucide-react";

// ── Quality scoring (server-side, same logic as DraftingLab) ─────────────────
function scoreIdea(content: string | null, category: string | null): number {
  if (!content) return 0;
  let score = 0;
  if (content.includes("##")) score += 15;
  if (content.includes("*"))  score += 15;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 250)   score += 40;
  else if (words > 0) score += Math.round((words / 250) * 40);
  if (category?.trim()) score += 30;
  return Math.min(score, 100);
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
    score >= 50 ? "text-amber-700  bg-amber-50  border-amber-200"  :
                  "text-red-600    bg-red-50    border-red-200";
  const label =
    score >= 80 ? "Strong" :
    score >= 50 ? "Fair"   : "Weak";

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1
      rounded-full border uppercase tracking-wider ${color}`}>
      {score >= 80 ? <CheckCircle2 size={10} /> :
       score >= 50 ? <Clock size={10} />         :
                     <AlertCircle size={10} />}
      {label} · {score}%
    </span>
  );
}

export default async function StudioPage() {
  const userId = await getAuthenticatedUserId();

  const drafts = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), eq(ideas.status, "draft")));

  // Score and sort: weakest first so the user works on what needs the most attention
  const scored = drafts
    .map((d) => ({ ...d, qualityScore: scoreIdea(d.content, d.category) }))
    .sort((a, b) => a.qualityScore - b.qualityScore);

  const avgScore = scored.length
    ? Math.round(scored.reduce((s, d) => s + d.qualityScore, 0) / scored.length)
    : 0;

  const readyToLaunch = scored.filter((d) => d.qualityScore >= 80).length;
  const needsWork     = scored.filter((d) => d.qualityScore <  50).length;

  return (
    <div className="min-h-screen bg-[#fafafa] py-12 px-6">
      <div className="max-w-3xl mx-auto">

        {/* BACK */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600
            mb-8 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* HEADER */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-teal-50 rounded-xl">
              <Sparkles className="text-[#0d9488]" size={22} />
            </div>
            <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">
              Drafts Workshop
            </p>
          </div>
          <h1
            className="text-4xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Idea Studio
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Polish your drafts before launching. Strong ideas earn more XP and engagement.
          </p>
        </div>

        {/* STAT STRIP */}
        {scored.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Drafts",          value: scored.length, color: "text-slate-900" },
              { label: "Avg Quality",     value: `${avgScore}%`, color: avgScore >= 80 ? "text-emerald-600" : avgScore >= 50 ? "text-amber-600" : "text-red-500" },
              { label: "Ready to Launch", value: readyToLaunch, color: "text-[#0d9488]" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-playfair)" }}>
                  {s.value}
                </p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* SCORE GUIDE */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Quality Score Breakdown
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
            {[
              { thing: "Uses ## headings", pts: "+15 pts" },
              { thing: "Uses * bullet points", pts: "+15 pts" },
              { thing: "250+ words", pts: "+40 pts" },
              { thing: "Category set", pts: "+30 pts" },
            ].map((r) => (
              <div key={r.thing} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="font-bold text-[#0d9488]">{r.pts}</p>
                <p className="mt-0.5">{r.thing}</p>
              </div>
            ))}
          </div>
        </div>

        {/* EMPTY STATE */}
        {scored.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-20
            text-center bg-white">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <FileText size={22} className="text-[#0d9488]" />
            </div>
            <p className="text-slate-400 text-lg font-medium" style={{ fontFamily: "var(--font-playfair)" }}>
              No drafts to polish yet.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Create a new idea first, then come back here to improve it before launching.
            </p>
            <Link
              href="/new"
              className="mt-6 inline-flex items-center gap-2 text-[#0d9488] font-bold hover:underline"
            >
              Create your first idea →
            </Link>
          </div>
        )}

        {/* DRAFT LIST */}
        {scored.length > 0 && (
          <div className="space-y-4">
            {needsWork > 0 && (
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold px-1">
                Weakest first — these need the most work
              </p>
            )}

            {scored.map((draft) => {
              const words = draft.content?.trim().split(/\s+/).filter(Boolean).length ?? 0;
              const hasHeadings = draft.content?.includes("##") ?? false;
              const hasBullets  = draft.content?.includes("*")  ?? false;
              const hasCategory = Boolean(draft.category?.trim());

              return (
                <div
                  key={draft.id}
                  className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm
                    hover:border-[#0d9488]/30 transition-all"
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-bold text-slate-900 text-lg leading-snug truncate"
                        style={{ fontFamily: "var(--font-playfair)" }}
                      >
                        {draft.title}
                      </h3>
                      {draft.hook && (
                        <p className="text-sm text-slate-500 italic mt-0.5 line-clamp-1">
                          "{draft.hook}"
                        </p>
                      )}
                    </div>
                    <ScoreBadge score={draft.qualityScore} />
                  </div>

                  {/* Quality checklist */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { label: `${words} words`,   done: words >= 250,    tip: "Need 250+" },
                      { label: "Headings",          done: hasHeadings,     tip: "Add ## headings" },
                      { label: "Bullets",           done: hasBullets,      tip: "Add * bullets" },
                      { label: "Category",          done: hasCategory,     tip: "Set a category" },
                    ].map(({ label, done, tip }) => (
                      <span
                        key={label}
                        title={done ? undefined : tip}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                          done
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50  text-slate-400  border-slate-200"
                        }`}
                      >
                        {done ? "✓" : "○"} {label}
                      </span>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        draft.qualityScore >= 80 ? "bg-emerald-500" :
                        draft.qualityScore >= 50 ? "bg-amber-400"   : "bg-red-400"
                      }`}
                      style={{ width: `${draft.qualityScore}%` }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/idea/${draft.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                        rounded-xl bg-[#0d9488] text-white text-xs font-bold
                        hover:bg-teal-700 transition-colors"
                    >
                      <FileText size={13} />
                      Edit & Improve
                    </Link>
                    {draft.qualityScore >= 80 && (
                      <Link
                        href={`/dashboard?tab=drafts`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                          bg-emerald-50 text-emerald-700 border border-emerald-200
                          text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                        <Rocket size={13} />
                        Ready to Launch
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
