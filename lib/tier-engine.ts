/**
 * lib/tier-engine.ts — v13
 *
 * Tier ladder: explorer → builder → architect → pioneer
 * New thresholds: 0 / 100 / 500 / 1500  (down from v12's 0/1000/5000/15000)
 * Tiers are non-degradable — only recalculated upward.
 */

export const TIERS = [
  {
    name: "explorer",
    label: "Explorer",
    minXp: 0,
    color: "text-slate-400",
    bg: "bg-slate-800",
    borderColor: "border-slate-700",
    featuresUnlocked: ["Public submissions", "Read reviews"],
  },
  {
    name: "builder",
    label: "Builder",
    minXp: 100,
    color: "text-teal-400",
    bg: "bg-teal-900",
    borderColor: "border-teal-700",
    featuresUnlocked: ["Private submissions", "Write reviews", "Feed"],
  },
  {
    name: "architect",
    label: "Architect",
    minXp: 500,
    color: "text-violet-400",
    bg: "bg-violet-900",
    borderColor: "border-violet-700",
    featuresUnlocked: ["IP Hard Lock", "Idea Registry"],
  },
  {
    name: "pioneer",
    label: "Pioneer",
    minXp: 1500,
    color: "text-amber-400",
    bg: "bg-amber-900",
    borderColor: "border-amber-700",
    featuresUnlocked: ["Registry Lock", "Full IP suite", "Leaderboard priority"],
  },
] as const;

export type TierName = (typeof TIERS)[number]["name"];

export const XP_EVENTS = {
  SUBMIT_PRIVATE_IDEA:     20,
  SUBMIT_PUBLIC_IDEA:      10,
  SUBMIT_PEER_REVIEW:       5,
  IDEA_GETS_5_REVIEWS:     15,
  IDEA_GETS_REMIXED:       25,
  VALID_REPORT_RESOLVED:   10,
  GENESIS_HASH_CONFIRMED:  30,
  REACH_TIER_2_BONUS:      50,
  REACH_TIER_3_BONUS:     100,
  RECEIVE_LIKE:             5,
  RECEIVE_COMMENT:         10,
  GAIN_FOLLOWER:            1,
  DELETE_IDEA:            -10,
  // Kept for backward-compat with any v12 callers
  LAUNCH_IDEA:             20, // alias for SUBMIT_PRIVATE_IDEA
  POST_COMMONS_IDEA:       10, // alias for SUBMIT_PUBLIC_IDEA
} as const;

export const TIER_WEIGHTS: Record<string, number> = {
  explorer:  1,
  builder:   1.5,
  architect: 2,
  pioneer:   5,
};

export function getTierFromXp(xp: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXp) {
      const t = TIERS[i];
      return {
        ...t,
        bgColor: t.bg,
        displayName: t.label,
      };
    }
  }
  const t = TIERS[0];
  return { ...t, bgColor: t.bg, displayName: t.label };
}

export function getTierNameFromXp(xp: number): TierName {
  return getTierFromXp(xp).name;
}

export function xpToNextTier(xp: number): number | null {
  const next = TIERS.find((t) => t.minXp > xp);
  return next ? next.minXp - xp : null;
}

export function tierProgress(xp: number): number {
  const current = getTierFromXp(xp);
  const nextMinXp = TIERS.find((t) => t.minXp > xp)?.minXp ?? null;
  if (!nextMinXp) return 100;
  return Math.round(
    ((xp - current.minXp) / (nextMinXp - current.minXp)) * 100
  );
}

/** Returns true if the given tier name meets the minimum required tier */
export function meetsMinTier(userTier: string, requiredTier: TierName): boolean {
  const userIdx = TIERS.findIndex((t) => t.name === userTier);
  const reqIdx  = TIERS.findIndex((t) => t.name === requiredTier);
  if (userIdx === -1 || reqIdx === -1) return false;
  return userIdx >= reqIdx;
}

/** Tier-1+ required for private idea submission */
export function canSubmitPrivate(userTier: string): boolean {
  return meetsMinTier(userTier, "builder");
}

/** Tier-1+ required for writing peer reviews */
export function canWriteReview(userTier: string): boolean {
  return meetsMinTier(userTier, "builder");
}

// Backward-compat shim — v12 had ProtectionLevel enum
export type ProtectionLevel = "open" | "guarded" | "shielded" | "vault";
export function canUseProtection(_xp: number, _level: ProtectionLevel): boolean {
  return true;
}
