export const TIERS = [
  {
    name: "dreamer",
    label: "Dreamer",
    minXp: 0,
    color: "text-slate-400",
    bg: "bg-slate-800",
    unlockedProtection: "open",
  },
  {
    name: "visionary",
    label: "Visionary",
    minXp: 500,
    color: "text-teal-400",
    bg: "bg-teal-900",
    unlockedProtection: "guarded",
  },
  {
    name: "architect",
    label: "Architect",
    minXp: 2000,
    color: "text-violet-400",
    bg: "bg-violet-900",
    unlockedProtection: "shielded",
  },
  {
    name: "oracle",
    label: "Oracle",
    minXp: 5000,
    color: "text-amber-400",
    bg: "bg-amber-900",
    unlockedProtection: "vault",
  },
] as const;

export type TierName = typeof TIERS[number]["name"];
export type ProtectionLevel = "open" | "guarded" | "shielded" | "vault";

export const XP_EVENTS = {
  LAUNCH_IDEA: 10,
  RECEIVE_LIKE: 5,
  GAIN_FOLLOWER: 1,
  RECALL_TO_DRAFT: 0,
  DELETE_IDEA: -10,
} as const;

export function getTierFromXp(xp: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXp) return TIERS[i];
  }
  return TIERS[0];
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

export function canUseProtection(xp: number, level: ProtectionLevel): boolean {
  const required: Record<ProtectionLevel, number> = {
    open: 0,
    guarded: 500,
    shielded: 2000,
    vault: 5000,
  };
  return xp >= required[level];
}
