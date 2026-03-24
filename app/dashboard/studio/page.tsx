import { db } from "@/db";
import { ideas } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles, FileText, Rocket, AlertCircle, CheckCircle2, Clock } from "lucide-react";
// FIX #33: Import shared scoreIdea — removed duplicate local function
import { scoreIdea } from "@/lib/scoreIdea";

function ScoreBadge({ score }: { score: number }) {
  // FIX #23: Use dark-theme-compatible colours
  const color =
    score >= 80 ? "text-emerald-400 bg-emerald-900/30 border-emerald-800" :
      score >= 50 ? "text-amber-400 bg-amber-900/30 border-amber-800" :
        "text-red-400 bg-red-900/30 border-red-800";
  const label =
    score >= 80 ? "Strong" :
      score >= 50 ? "Fair" : "Weak";

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1
      rounded-full border uppercase tracking-wider ${color}`}>
      {score >= 80 ? <CheckCircle2 size={10} /> :
        score >= 50 ? <Clock size={10} /> :
          <AlertCircle size={10} />}
      {label} · {score}%
    </span>
  );
}

export default async function StudioPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/sign-in");

  const drafts = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), eq(ideas.status, "draft")));

  const scored = drafts
    .map((d) => ({ ...d, qualityScore: scoreIdea(d.content, d.category) }))
    .sort((a, b) => a.qualityScore - b.qualityScore);

  const avgScore = scored.length
    ? Math.round(scored.reduce((s, d) => s + d.qualityScore, 0) / scored.length)
    : 0;

  const readyToLaunch = scored.filter((d) => d.qualityScore >= 80).length;
  const needsWork = scored.filter((d) => d.qualityScore < 50).length;

  return (
    // FIX #23: bg-slate-950 to match global dark theme — was bg-[#fafafa] (light)
    <div className="min-h-screen bg-slate-950 py-12 px-6">
      <div className="max-w-3xl mx-auto">

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white
            mb-8 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-teal-500/10 rounded-xl">
              <Sparkles className="text-[#0d9488]" size={22} />
            </div>
            <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">
              Drafts Workshop
            </p>
          </div>
          <h1
            className="text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Idea Studio
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Polish your drafts before launching. Strong ideas earn more XP and engagement.
          </p>
        </div>

        {scored.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Drafts", value: scored.length, color: "text-white" },
              { label: "Avg Quality", value: `${avgScore}%`, color: avgScore >= 80 ? "text-emerald-400" : avgScore >= 50 ? "text-amber-400" : "text-red-400" },
              { label: "Ready to Launch", value: readyToLaunch, color: "text-[#0d9488]" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            Quality Score Breakdown
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400">
            {[
              { thing: "Uses ## headings", pts: "+15 pts" },
              { thing: "Uses * bullet points", pts: "+15 pts" },
              { thing: "250+ words", pts: "+40 pts" },
              { thing: "Category set", pts: "+30 pts" },
            ].map((r) => (
              <div key={r.thing} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="font-bold text-[#0d9488]">{r.pts}</p>
                <p className="mt-0.5">{r.thing}</p>
              </div>
            ))}
          </div>
        </div>

        {scored.length === 0 && (
          <div className="border-2 border-dashed border-slate-800 rounded-3xl p-20
            text-center bg-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
              <FileText size={22} className="text-[#0d9488]" />
            </div>
            <p className="text-slate-400 text-lg font-medium" style={{ fontFamily: "var(--font-playfair)" }}>
              No drafts to polish yet.
            </p>
            <p className="text-slate-500 text-sm mt-1">
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

        {scored.length > 0 && (
          <div className="space-y-4">
            {needsWork > 0 && (
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold px-1">
                Weakest first — these need the most work
              </p>
            )}

            {scored.map((draft) => {
              const words = draft.content?.trim().split(/\s+/).filter(Boolean).length ?? 0;
              const hasHeadings = draft.content?.includes("##") ?? false;
              const hasBullets = draft.content?.includes("*") ?? false;
              const hasCategory = Boolean(draft.category?.trim());

              return (
                <div
                  key={draft.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6
                    hover:border-teal-700/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-bold text-white text-lg leading-snug truncate"
                        style={{ fontFamily: "var(--font-playfair)" }}
                      >
                        {draft.title}
                      </h3>
                      {draft.context && (
                        <p className="text-sm text-slate-500 italic mt-0.5 line-clamp-1">
                          &quot;{draft.context}&quot;
                        </p>
                      )}
                    </div>
                    <ScoreBadge score={draft.qualityScore} />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { label: `${words} words`, done: words >= 250, tip: "Need 250+" },
                      { label: "Headings", done: hasHeadings, tip: "Add ## headings" },
                      { label: "Bullets", done: hasBullets, tip: "Add * bullets" },
                      { label: "Category", done: hasCategory, tip: "Set a category" },
                    ].map(({ label, done, tip }) => (
                      <span
                        key={label}
                        title={done ? undefined : tip}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                          done
                            ? "bg-emerald-900/30 text-emerald-400 border-emerald-800"
                            : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}
                      >
                        {done ? "✓" : "○"} {label}
                      </span>
                    ))}
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        draft.qualityScore >= 80 ? "bg-emerald-500" :
                        draft.qualityScore >= 50 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${draft.qualityScore}%` }}
                    />
                  </div>

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
                          bg-emerald-900/30 text-emerald-400 border border-emerald-800
                          text-xs font-bold hover:bg-emerald-900/50 transition-colors"
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
