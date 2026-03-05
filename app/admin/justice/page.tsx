// app/admin/justice/page.tsx
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { ideas, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Zap } from "lucide-react";
import { performJusticeAudit, batchAuditUnscanned } from "@/app/actions/justiceActions";
import { Suspense } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Re-Audit Button (Client Component)
// ─────────────────────────────────────────────────────────────────────────────
function ReAuditButton({ ideaId }: { ideaId: string }) {
    return (
        <form action={performJusticeAudit.bind(null, ideaId)}>
            <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
          text-[#0d9488] bg-teal-50 rounded-lg hover:bg-teal-100 
          transition-colors border border-teal-200"
            >
                <RefreshCw size={12} />
                Re-Audit
            </button>
        </form>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Scan Button
// ─────────────────────────────────────────────────────────────────────────────
function BatchScanButton() {
    return (
        <form action={batchAuditUnscanned}>
            <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold
          text-white bg-[#0d9488] rounded-xl hover:bg-teal-700 
          transition-colors shadow-md shadow-teal-100"
            >
                <Zap size={16} />
                Scan All Unscanned
            </button>
        </form>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Justice Table Content
// ─────────────────────────────────────────────────────────────────────────────
async function JusticeTable() {
    // Fetch all public ideas with author info
    const publicIdeas = await db
        .select({
            id: ideas.id,
            title: ideas.title,
            userId: ideas.userId,
            genesisHash: ideas.genesisHash,
            aiMetadata: ideas.aiMetadata,
            totalLikes: ideas.totalLikes,
            views: ideas.views,
            createdAt: ideas.createdAt,
            author: {
                name: users.name,
                handle: users.handle,
            },
        })
        .from(ideas)
        .leftJoin(users, eq(ideas.userId, users.id))
        .where(eq(ideas.status, "public"))
        .orderBy(desc(ideas.createdAt));

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <div className="col-span-3">Idea</div>
                <div className="col-span-2">Author</div>
                <div className="col-span-2">Genesis Hash</div>
                <div className="col-span-1 text-center">Risk</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-1 text-center">Engagement</div>
                <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100">
                {publicIdeas.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-400">
                        No public ideas found.
                    </div>
                ) : (
                    publicIdeas.map((idea) => {
                        const metadata = idea.aiMetadata as any;
                        const isScanned = metadata?.scanned ?? false;
                        const riskScore = metadata?.riskScore ?? null;
                        const status = metadata?.status ?? "pending";
                        const authorName = idea.author?.name || idea.author?.handle || "Anonymous";

                        // Status styling
                        const statusConfig = {
                            verified: {
                                icon: CheckCircle,
                                color: "text-emerald-600",
                                bg: "bg-emerald-50",
                                border: "border-emerald-200",
                                label: "Verified",
                            },
                            flagged: {
                                icon: AlertTriangle,
                                color: "text-amber-600",
                                bg: "bg-amber-50",
                                border: "border-amber-200",
                                label: "Flagged",
                            },
                            pending: {
                                icon: Shield,
                                color: "text-slate-400",
                                bg: "bg-slate-50",
                                border: "border-slate-200",
                                label: "Pending",
                            },
                        };

                        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
                        const StatusIcon = config.icon;

                        return (
                            <div
                                key={idea.id}
                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 transition-colors items-center"
                            >
                                {/* Idea Title */}
                                <div className="col-span-3">
                                    <a
                                        href={`/idea/${idea.id}`}
                                        className="font-semibold text-sm text-slate-900 hover:text-[#0d9488] line-clamp-1"
                                        style={{ fontFamily: "var(--font-playfair)" }}
                                    >
                                        {idea.title}
                                    </a>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {idea.createdAt
                                            ? new Date(idea.createdAt).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : ""}
                                    </p>
                                </div>

                                {/* Author */}
                                <div className="col-span-2">
                                    <p className="text-sm text-slate-600 line-clamp-1">{authorName}</p>
                                </div>

                                {/* Genesis Hash (truncated) */}
                                <div className="col-span-2">
                                    <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-mono">
                                        {idea.genesisHash
                                            ? `${idea.genesisHash.slice(0, 8)}...${idea.genesisHash.slice(-6)}`
                                            : "N/A"}
                                    </code>
                                </div>

                                {/* Risk Score */}
                                <div className="col-span-1 text-center">
                                    {isScanned && riskScore !== null ? (
                                        <span
                                            className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm ${riskScore > 75
                                                    ? "bg-red-100 text-red-700"
                                                    : riskScore > 50
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-emerald-100 text-emerald-700"
                                                }`}
                                        >
                                            {riskScore}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                    )}
                                </div>

                                {/* Audit Status */}
                                <div className="col-span-2 flex justify-center">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${config.color} ${config.bg} ${config.border}`}
                                    >
                                        <StatusIcon size={12} />
                                        {config.label}
                                    </span>
                                </div>

                                {/* Engagement */}
                                <div className="col-span-1 text-center">
                                    <p className="text-xs text-slate-500">
                                        ❤️ {idea.totalLikes} · 👁 {idea.views}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="col-span-1 flex justify-end">
                                    <ReAuditButton ideaId={idea.id} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function JusticeTableSkeleton() {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="space-y-4 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className="h-12 flex-1 bg-slate-100 rounded-lg" />
                        <div className="h-12 w-24 bg-slate-100 rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Cards Component
// ─────────────────────────────────────────────────────────────────────────────
async function StatsCards() {
    const allIdeas = await db
        .select({
            aiMetadata: ideas.aiMetadata,
        })
        .from(ideas)
        .where(eq(ideas.status, "public"));

    const totalPublic = allIdeas.length;
    const scanned = allIdeas.filter((i) => (i.aiMetadata as any)?.scanned).length;
    const verified = allIdeas.filter((i) => (i.aiMetadata as any)?.status === "verified").length;
    const flagged = allIdeas.filter((i) => (i.aiMetadata as any)?.status === "flagged").length;

    const stats = [
        { label: "Total Public", value: totalPublic, color: "bg-blue-50 text-blue-700" },
        { label: "Scanned", value: scanned, color: "bg-teal-50 text-teal-700" },
        { label: "Verified", value: verified, color: "bg-emerald-50 text-emerald-700" },
        { label: "Flagged", value: flagged, color: "bg-amber-50 text-amber-700" },
    ];

    return (
        <>
            {stats.map((stat, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {stat.label}
                    </p>
                    <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                </div>
            ))}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Admin Page - WITH PROTECTION
// ─────────────────────────────────────────────────────────────────────────────
export default async function JusticeAdminPage() {
    // 🔒 ADMIN PROTECTION - THIS IS THE FIX!
    try {
        await requireAdmin();
    } catch (error) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-[#f8fafb] p-4 md:p-8">
            <div className="max-w-[1400px] mx-auto">
                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-[#0d9488]/10 rounded-xl">
                            <Shield className="text-[#0d9488]" size={22} />
                        </div>
                        <p className="text-sm font-semibold text-[#0d9488] uppercase tracking-widest">
                            Admin Dashboard
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1
                                className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight"
                                style={{ fontFamily: "var(--font-playfair)" }}
                            >
                                Justice Engine
                            </h1>
                            <p className="text-slate-500 mt-2">
                                AI-powered content auditing and IP protection
                            </p>
                        </div>
                        <BatchScanButton />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Suspense fallback={<div className="bg-white rounded-2xl h-24 animate-pulse" />}>
                        <StatsCards />
                    </Suspense>
                </div>

                {/* Justice Table */}
                <Suspense fallback={<JusticeTableSkeleton />}>
                    <JusticeTable />
                </Suspense>
            </div>
        </div>
    );
}
