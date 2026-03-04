"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Rocket,
  Trash2,
  Edit3,
  Eye,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Shield,
  ShieldOff,
  GitBranch,
  Fingerprint,
  Heart,
  CheckCircle,
  AlertTriangle,
  Users,
  Lock,
  Unlock,
  Award,
} from "lucide-react";
import { launchIdea, deleteIdea, recallIdea, requestAccess } from "@/app/actions/ideaActions";
import type { Idea } from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────
// Protection level config
// ─────────────────────────────────────────────────────────────────────────
const PROTECTION_CONFIG = {
  0: {
    label: "Open",
    icon: ShieldOff,
    color: "text-slate-400",
    bg: "bg-slate-50 border-slate-200",
  },
  1: {
    label: "Guarded",
    icon: Shield,
    color: "text-[#0d9488]",
    bg: "bg-[#0d9488]/10 border-[#0d9488]/20",
  },
  2: {
    label: "Shielded",
    icon: ShieldCheck,
    color: "text-[#0d9488]",
    bg: "bg-[#0d9488]/10 border-[#0d9488]/30",
  },
  3: {
    label: "Vault",
    icon: ShieldCheck,
    color: "text-[#0d9488]",
    bg: "bg-[#0d9488]/10 border-[#0d9488]/40",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Tier config for author display
// ─────────────────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  initiate: {
    label: "Initiate",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  architect: {
    label: "Architect",
    color: "text-[#0d9488]",
    bgColor: "bg-[#0d9488]/10",
    borderColor: "border-[#0d9488]/30",
  },
  master: {
    label: "Master",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
  genesis_legend: {
    label: "Genesis Legend",
    color: "text-amber-600",
    bgColor: "bg-gradient-to-br from-amber-50 to-yellow-50",
    borderColor: "border-amber-300",
  },
} as const;

interface Author {
  id: string;
  name: string | null;
  handle: string | null;
  image: string | null;
  tier: string | null;
  xp?: number | null;
}

interface IdeaCardProps {
  idea: Idea;
  author?: Author | null;
  showActions?: boolean;
  viewerId?: string;
}

export default function IdeaCard({
  idea,
  author,
  showActions = false,
  viewerId = "user_test_123",
}: IdeaCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // ── Action runner ──────────────────────────────────────────────────────────
  const run = async (key: string, action: (id: string) => Promise<unknown>) => {
    try {
      setLoading(key);
      await action(idea.id);
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  };

  // ── Two-stage delete ───────────────────────────────────────────────────────
  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      const t = setTimeout(() => setConfirmDelete(false), 3000);
      setDeleteTimer(t);
    } else {
      if (deleteTimer) clearTimeout(deleteTimer);
      setConfirmDelete(false);
      run("delete", deleteIdea);
    }
  };

  // ── Access Request Handlers ────────────────────────────────────────────────
  const handleAccessRequest = async (level: "viewer" | "partner") => {
    setLoading(`access-${level}`);
    const result = await requestAccess(idea.id, level);
    setLoading(null);

    if (result.success) {
      alert(result.message);
      window.location.reload();
    } else {
      alert(result.error || "Failed to request access");
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const statusColors: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    public: "bg-teal-50 text-teal-700 border-teal-200",
  };

  const blurLevel = idea.blurLevel ?? 0;
  const protection =
    PROTECTION_CONFIG[blurLevel as keyof typeof PROTECTION_CONFIG] ??
    PROTECTION_CONFIG[0];
  const ProtIcon = protection.icon;

  const hookPreview = (() => {
    const source = idea.hook || idea.content || "";
    return source.length > 150 ? source.slice(0, 150) + "…" : source;
  })();

  const viewerCount = idea.viewerIds?.length ?? 0;
  const partnerCount = idea.partnerIds?.length ?? 0;
  const hasGenesis = Boolean(idea.genesisHash);

  // ── Author tier config ─────────────────────────────────────────────────────
  const authorTier = (author?.tier || "initiate") as keyof typeof TIER_CONFIG;
  const tierConfig = TIER_CONFIG[authorTier] || TIER_CONFIG.initiate;

  // ── Audit Status ───────────────────────────────────────────────────────────
  const auditMetadata = idea.aiMetadata as any;
  const isScanned = auditMetadata?.scanned ?? false;
  const auditStatus = auditMetadata?.status ?? null;

  // ── Phase 5: Access Control ────────────────────────────────────────────────
  const isOwner = idea.userId === viewerId;
  const isViewer = idea.viewerIds?.includes(viewerId) ?? false;
  const isPartner = idea.partnerIds?.includes(viewerId) ?? false;

  // Content visibility logic
  const hasAccess = isOwner || isViewer || isPartner || blurLevel === 0;
  const isBlurred = blurLevel > 0 && !hasAccess;

  // Button logic
  const canRequestViewer = !isOwner && !isViewer && !isPartner && idea.status === "public";
  const canUpgradeToPartner = !isOwner && isViewer && !isPartner && idea.status === "public";

  return (
    <div className="group bg-white border border-slate-100 rounded-3xl p-6 hover:border-[#0d9488]/30 hover:shadow-lg transition-all duration-300 flex flex-col gap-4">
      {/* ── TOP ROW ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <span
          className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${statusColors[idea.status ?? "draft"] ?? statusColors.draft
            }`}
        >
          {idea.status === "public" ? "Live" : "Archived"}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">
          {idea.createdAt
            ? new Date(idea.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
            : ""}
        </span>
      </div>

      {/* ── CATEGORY + TITLE ──────────────────────────────────────────────── */}
      <div>
        <span className="text-[10px] font-semibold text-[#0d9488] uppercase tracking-widest">
          {idea.category ?? "General"}
        </span>
        <h3
          className="text-lg font-bold text-slate-900 leading-snug mt-1 group-hover:text-[#0d9488] transition-colors"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {idea.title}
        </h3>

        {/* ── AUTHOR LINK (Phase 8 Update) ──────────────────────────────────── */}
        <Link
          href={`/profile/${author?.handle || author?.id || "unknown"}`}
          className="flex items-center gap-2 mt-3 hover:opacity-70 transition-opacity w-fit"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${tierConfig.bgColor} ${tierConfig.color} border-2 ${tierConfig.borderColor}`}
          >
            {author?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex flex-col">
            <p className="text-xs font-semibold text-slate-900">
              {author?.name || "Anonymous"}
            </p>
            <p className="text-[10px] text-slate-500">
              @{author?.handle || "unknown"}
              {author?.xp !== undefined && (
                <span className={`ml-1 font-bold ${tierConfig.color}`}>
                  · {author.xp} XP
                </span>
              )}
            </p>
          </div>
        </Link>
      </div>

      {/* ── CONTENT / BLUR GUARD ──────────────────────────────────────────── */}
      {isBlurred ? (
        <div className="relative bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 rounded-2xl p-8 border-2 border-slate-200 overflow-hidden">
          {/* Blur overlay */}
          <div className="absolute inset-0 backdrop-blur-md bg-white/60 rounded-2xl flex items-center justify-center z-10">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                <Lock className="text-slate-500" size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Protected Content</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Request access to unlock this idea
                </p>
              </div>
              <button
                onClick={() => handleAccessRequest("viewer")}
                disabled={loading === "access-viewer"}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold
                  text-white bg-gradient-to-r from-slate-600 to-slate-700 
                  rounded-xl hover:from-slate-700 hover:to-slate-800 
                  disabled:opacity-50 transition-all shadow-lg mx-auto"
              >
                {loading === "access-viewer" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Unlock size={16} />
                )}
                Get Access
              </button>
            </div>
          </div>
          {/* Blurred content behind */}
          <div className="blur-sm select-none pointer-events-none opacity-20">
            <p className="text-sm text-slate-500 italic line-clamp-4">
              {hookPreview}
            </p>
          </div>
        </div>
      ) : (
        <div>
          {hookPreview && (
            <p className="text-sm text-slate-500 italic line-clamp-2">
              "{hookPreview}"
            </p>
          )}
        </div>
      )}

      {/* ── BADGES ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Protection */}
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1
          rounded-full border uppercase tracking-wider ${protection.color} ${protection.bg}`}
        >
          <ProtIcon size={10} />
          {protection.label}
        </span>

        {/* Genesis */}
        {hasGenesis && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1
            rounded-full border uppercase tracking-wider text-emerald-700 bg-emerald-50 border-emerald-200"
          >
            <Fingerprint size={10} />
            Genesis ✓
          </span>
        )}

        {/* Your Role Badge - Silver for Viewer */}
        {isViewer && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1
            rounded-full border uppercase tracking-wider text-slate-700 bg-slate-100 border-slate-300"
          >
            <Eye size={10} />
            Viewer Access
          </span>
        )}

        {/* Your Role Badge - Gold/Teal for Partner */}
        {isPartner && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1
            rounded-full border uppercase tracking-wider text-[#0d9488] bg-gradient-to-r from-yellow-50 to-[#0d9488]/10 border-[#0d9488]/30"
          >
            <Award size={10} />
            Partner
          </span>
        )}
      </div>

      {/* ── AUDIT STATUS ───────────────────────────────────────────────────── */}
      {isScanned && auditStatus && (
        <div className="flex items-center gap-2">
          {auditStatus === "verified" && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
              <CheckCircle size={10} />
              <span>Verified</span>
            </div>
          )}
          {auditStatus === "flagged" && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
              <AlertTriangle size={10} />
              <span>Under Review</span>
            </div>
          )}
        </div>
      )}

      {/* ── TEAM STATS ─────────────────────────────────────────────────────── */}
      {(viewerCount > 0 || partnerCount > 0) && (
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          {viewerCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-slate-500" />
              <span>{viewerCount} Viewer{viewerCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          {partnerCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Award size={12} className="text-[#0d9488]" />
              <span>{partnerCount} Partner{partnerCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* ── STATS + ACTIONS ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mt-auto">
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <button
            className="flex items-center gap-1.5 text-slate-400 hover:text-[#0d9488] 
              transition-all hover:scale-110 active:scale-95"
            aria-label="Like this idea"
          >
            <Heart size={14} className="hover:fill-current" />
            <span>{idea.totalLikes ?? 0}</span>
          </button>
          <span className="text-slate-400 flex items-center gap-1.5">
            👁 {idea.views ?? 0} views
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-50 flex-wrap">
          {/* View */}
          <Link
            href={`/idea/${idea.id}`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
              text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Eye size={13} /> View
          </Link>

          {/* Phase 5: Get Access Button */}
          {canRequestViewer && (
            <button
              onClick={() => handleAccessRequest("viewer")}
              disabled={loading === "access-viewer"}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                text-white bg-slate-600 rounded-xl hover:bg-slate-700 
                disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading === "access-viewer" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Unlock size={13} />
              )}
              Get Access
            </button>
          )}

          {/* Phase 5: Become Partner Button */}
          {canUpgradeToPartner && (
            <button
              onClick={() => handleAccessRequest("partner")}
              disabled={loading === "access-partner"}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                text-white bg-gradient-to-r from-[#0d9488] to-teal-600 rounded-xl 
                hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 
                transition-all shadow-sm shadow-teal-100"
            >
              {loading === "access-partner" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Award size={13} />
              )}
              Become Partner
            </button>
          )}

          {showActions && (
            <>
              {/* Edit */}
              <Link
                href={`/idea/${idea.id}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
                  text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Edit3 size={13} /> Edit
              </Link>

              {/* Launch / Recall */}
              {idea.status === "draft" ? (
                <button
                  onClick={() => run("launch", launchIdea)}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white
                    bg-[#0d9488] rounded-xl hover:bg-teal-700 disabled:opacity-50
                    transition-colors ml-auto shadow-sm shadow-teal-100"
                >
                  {loading === "launch" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Rocket size={13} />
                  )}
                  Launch
                </button>
              ) : (
                <button
                  onClick={() => run("recall", recallIdea)}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
                    text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200
                    disabled:opacity-50 transition-colors ml-auto"
                >
                  {loading === "recall" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Recall
                </button>
              )}

              {/* Delete */}
              <button
                onClick={handleDeleteClick}
                disabled={loading === "delete"}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
                  rounded-xl disabled:opacity-50 transition-all ${confirmDelete
                    ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                    : "text-red-400 bg-red-50 hover:bg-red-100"
                  }`}
              >
                {loading === "delete" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                {confirmDelete ? "Sure?" : ""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
