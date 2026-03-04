/**
 * lib/tier-engine.ts
 * 
 * XP-based tier progression system.
 * Calculates user rank and visual styling based on lifetime XP.
 */

export type TierName = "initiate" | "architect" | "master" | "genesis_legend";

export interface Tier {
  name: TierName;
  displayName: string;
  minXp: number;
  maxXp: number | null; // null for highest tier
  color: string;
  bgColor: string;
  borderColor: string;
  gradient: string;
  icon: string; // Emoji or icon identifier
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export const TIERS: Record<TierName, Tier> = {
  initiate: {
    name: "initiate",
    displayName: "Initiate",
    minXp: 0,
    maxXp: 49,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    gradient: "from-slate-400 to-slate-600",
    icon: "🌱",
  },
  architect: {
    name: "architect",
    displayName: "Architect",
    minXp: 50,
    maxXp: 199,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
    gradient: "from-blue-400 to-blue-600",
    icon: "🏗️",
  },
  master: {
    name: "master",
    displayName: "Master",
    minXp: 200,
    maxXp: 499,
    color: "text-[#0d9488]",
    bgColor: "bg-teal-100",
    borderColor: "border-teal-300",
    gradient: "from-teal-400 to-teal-600",
    icon: "⚡",
  },
  genesis_legend: {
    name: "genesis_legend",
    displayName: "Genesis Legend",
    minXp: 500,
    maxXp: null,
    color: "text-yellow-600",
    bgColor: "bg-gradient-to-r from-yellow-100 to-amber-100",
    borderColor: "border-yellow-400",
    gradient: "from-yellow-400 to-amber-600",
    icon: "👑",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GET TIER FROM XP
// ─────────────────────────────────────────────────────────────────────────────
export function getTier(xp: number): Tier {
  if (xp >= 500) return TIERS.genesis_legend;
  if (xp >= 200) return TIERS.master;
  if (xp >= 50) return TIERS.architect;
  return TIERS.initiate;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET TIER NAME (for database storage)
// ─────────────────────────────────────────────────────────────────────────────
export function getTierNameFromXp(xp: number): TierName {
  return getTier(xp).name;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET PROGRESS TO NEXT TIER
// ─────────────────────────────────────────────────────────────────────────────
export function getTierProgress(xp: number): {
  current: Tier;
  next: Tier | null;
  progress: number; // 0-100
  xpToNext: number;
} {
  const current = getTier(xp);

  // Already at max tier
  if (current.maxXp === null) {
    return {
      current,
      next: null,
      progress: 100,
      xpToNext: 0,
    };
  }

  const nextTierMinXp = current.maxXp + 1;
  const nextTier = getTier(nextTierMinXp);

  const tierRange = current.maxXp - current.minXp + 1;
  const currentProgress = xp - current.minXp;
  const progress = Math.min(100, Math.round((currentProgress / tierRange) * 100));
  const xpToNext = (current.maxXp + 1) - xp;

  return {
    current,
    next: nextTier,
    progress,
    xpToNext,
  };
}
