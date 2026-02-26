import { TIER_CONFIG } from "./tier-engine";

/**
 * Logic to check if a user can see the 'Vision' (Private) part of an idea.
 */
export function canAccessVision(userTier: number, requiredTier: number): boolean {
    // Tier 1 content is public for all.
    if (requiredTier <= 1) return true;

    // User must meet or exceed the required rank.
    return userTier >= requiredTier;
}

/**
 * Helper to get the name of the rank required.
 */
export function getRequiredRankName(tier: number): string {
    // @ts-ignore
    return TIER_CONFIG[tier]?.name || "Architect";
}