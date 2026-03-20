/**
 * HackerNews-style feed score — v11-justice
 * score = (sparks * 3 + views) / (ageInHours + 2)^1.3
 * Gravity reduced 1.5→1.3: complex ideas stay visible longer
 */
export function computeFeedScore(
    totalLikes: number,
    views: number,
    createdAt: Date | null
): number {
    const ageMs = Date.now() - new Date(createdAt ?? Date.now()).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const gravity = Math.pow(ageHours + 2, 1.3); // v11: 1.5 → 1.3
    return (totalLikes * 3 + views) / gravity;
}
