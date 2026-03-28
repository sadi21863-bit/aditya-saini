/**
 * lib/tier-engine.ts — v12
 *
 * Tier ladder: starter → builder → architect → grand_architect
 * All names, labels, XP thresholds, and helper functions updated for v12.
 * Keeps all previously exported function signatures intact so no callers break.
 */

export const TIERS = [
  {
    name: "starter",
    label: "Starter",
    minXp: 0,
    color: "text-slate-400",
    bg: "bg-slate-800",
  },
  {
    name: "builder",
    label: "Builder",
    minXp: 1000,
    color: "text-teal-400",
    bg: "bg-teal-900",
  },
  {
    name: "architect",
    label: "Architect",
    minXp: 5000,
    color: "text-violet-400",
    bg: "bg-violet-900",
  },
  {
    name: "grand_architect",
    label: "Grand Architect",
    minXp: 15000,
    color: "text-amber-400",
    bg: "bg-amber-900",
  },
] as const;

export type TierName = (typeof TIERS)[number]["name"];

// Kept for backward-compat with callers that import ProtectionLevel,
// but protection-gating is removed from v12 idea creation.
export type ProtectionLevel = "open" | "guarded" | "shielded" | "vault";

export const XP_EVENTS = {
  LAUNCH_IDEA: 50,
  RECEIVE_LIKE: 5,
  GAIN_FOLLOWER: 1,
  PEER_REVIEW_GIVEN: 3,
  SUBMIT_COMMUNITY_NOTE: 2,
  RECALL_TO_DRAFT: 0,
  DELETE_IDEA: -10,
  POST_COMMONS_IDEA: 30,
  RECEIVE_COMMENT: 10,
  CHALLENGE_WIN: 150,
} as const;

export const TIER_WEIGHTS: Record<string, number> = {
  starter: 1,
  builder: 1.5,
  architect: 2,
  grand_architect: 5,
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

export function getTierNameFromXp(xp: number): string {
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

/**
 * canUseProtection — kept for backward-compat.
 * In v12 there is no protection level on vault ideas (ipProtected is a boolean).
 * This always returns true so old callers don't break.
 */
export function canUseProtection(
  _xp: number,
  _level: ProtectionLevel
): boolean {
  return true;
}
