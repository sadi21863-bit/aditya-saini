import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import {
  performJusticeAudit,
  batchAuditUnscanned,
  manualOverride,
} from "@/app/actions/justiceActions";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Activity,
  Scale,
} from "lucide-react";

// v12: similarityFlags table removed — that section is replaced with a placeholder

type AiMeta = {
  scanned?: boolean;
  riskScore?: number;
  lastAudit?: string;
  status?: "verified" | "flagged";
  manualOverride?: boolean;
};

export default async function JusticePage() {
  const callerId = await getAuthenticatedUserId();
  if (!callerId) redirect("/feed");

  const adminCheck = await isAdmin();
  if (!adminCheck) redirect("/feed");

  const me = await db.query.users.findFirst({
    where: eq(users.id, callerId),
  });

  // v12: status is "published" (not "public")
  const allPublicIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      userId: ideas.userId,
      createdAt: ideas.createdAt,
      totalLikes: ideas.totalLikes,
      views: ideas.views,
      aiMetadata: ideas.aiMetadata,
    })
    .from(ideas)
    .where(eq(ideas.status, "published"))
    .orderBy(desc(ideas.createdAt));

  const allUsers = await db
    .select({ id: users.id, handle: users.handle, name: users.name })
    .from(users);
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

  const total = allPublicIdeas.length;
  const scanned = allPublicIdeas.filter(
    (i) => (i.aiMetadata as AiMeta)?.scanned
  ).length;
  const flagged = allPublicIdeas.filter(
    (i) => (i.aiMetadata as AiMeta)?.status === "flagged"
  ).length;
  const unscanned = total - scanned;

  function riskColor(score?: number) {
    if (score === undefined) return "text-slate-500";
    if (score > 75) return "text-red-400";
    if (score >= 40) return "text-yellow-400";
    return "text-emerald-400";
  }

  function statusBadge(meta: AiMeta | null) {
    if (!meta?.scanned)
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 uppercase">
          Unscanned
        </span>
      );
    if (meta.status === "flagged")
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 text-red-400 uppercase border border-red-800">
          Flagged
        </span>
      );
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-400 uppercase border border-emerald-800">
        Verified
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/10 flex items-center justify-center">
              <Scale size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Justice Engine</h1>
              <p className="text-slate-400 text-sm">
                AI-powered content audit &amp; risk scoring
              </p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await batchAuditUnscanned();
            }}
          >
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0d9488] hover:bg-teal-500
                text-white font-bold text-sm transition-colors flex items-center gap-2"
            >
              <Activity size={14} />
              Batch Audit All
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Published Ideas", value: total, icon: ShieldOff, color: "text-slate-400" },
            { label: "Scanned", value: scanned, icon: ShieldCheck, color: "text-emerald-400" },
            { label: "Flagged", value: flagged, icon: AlertTriangle, color: "text-red-400" },
            { label: "Unscanned", value: unscanned, icon: Activity, color: "text-yellow-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <Icon size={18} className={`${color} mb-2`} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Ideas Audit Table */}
        <div className="mb-12">
          <h2 className="text-lg font-bold mb-4">Published Ideas Audit</h2>
          <div className="rounded-2xl border border-slate-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Title</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Author</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Risk Score</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Last Audit</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPublicIdeas.map((idea) => {
                  const meta = idea.aiMetadata as AiMeta | null;
                  const author = userMap[idea.userId ?? ""];
                  return (
                    <tr
                      key={idea.id}
                      className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/idea/${idea.id}`}
                          className="font-medium text-white hover:text-[#0d9488] transition-colors line-clamp-1"
                        >
                          {idea.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {author?.handle ? (
                          <Link
                            href={`/profile/${author.handle}`}
                            className="hover:text-white transition-colors"
                          >
                            @{author.handle}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${riskColor(meta?.riskScore)}`}>
                          {meta?.riskScore !== undefined
                            ? `${meta.riskScore}/100`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(meta)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {meta?.lastAudit
                          ? new Date(meta.lastAudit).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <form
                            action={async () => {
                              "use server";
                              await performJusticeAudit(idea.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded-lg bg-[#0d9488]/10 text-[#0d9488]
                                text-xs font-bold hover:bg-[#0d9488]/20 transition"
                            >
                              Audit
                            </button>
                          </form>
                          <form
                            action={async () => {
                              "use server";
                              await manualOverride(idea.id, "verified");
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded-lg bg-emerald-900/30 text-emerald-400
                                text-xs font-bold hover:bg-emerald-900/50 transition"
                            >
                              Verify
                            </button>
                          </form>
                          <form
                            action={async () => {
                              "use server";
                              await manualOverride(idea.id, "flagged");
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded-lg bg-red-900/30 text-red-400
                                text-xs font-bold hover:bg-red-900/50 transition"
                            >
                              Flag
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {allPublicIdeas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No published ideas yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Similarity Flags — removed in v12 (similarityFlags table dropped) */}
        <div>
          <h2 className="text-lg font-bold mb-4">Similarity Flags</h2>
          <div className="rounded-2xl border border-slate-800 p-10 text-center text-slate-500 text-sm">
            Similarity flag detection has been removed in v12.
            Near-duplicate detection will be re-introduced in a future release.
          </div>
        </div>

      </div>
    </div>
  );
}
