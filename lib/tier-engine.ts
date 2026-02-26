export const TIER_CONFIG = {
    1: { name: "Dreamer", minSparks: 0, minMerges: 0 },
    2: { name: "Sparker", minSparks: 100, minMerges: 0 },
    3: { name: "Architect", minSparks: 500, minMerges: 1 },
    4: { name: "Partner", minSparks: 1000, minMerges: 3 },
    5: { name: "Visionary", minSparks: 5000, minMerges: 10 },
};

/**
 * Calculates the user's tier based on their total Sparks and Merges.
 */
export function getTierFromStats(sparks: number, merges: number): number {
    if (sparks >= 5000 && merges >= 10) return 5;
    if (sparks >= 1000 && merges >= 3) return 4;
    if (sparks >= 500 && merges >= 1) return 3;
    if (sparks >= 100) return 2;
    return 1;
}