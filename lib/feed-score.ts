/**
 * HackerNews-style feed score.
 * score = (sparks * 3 + views) / (ageInHours + 2)^1.5
 * Higher score = higher rank.
 */
export function computeFeedScore(
    totalLikes: number,
    views: number,
    createdAt: Date | null
): number {
    const ageMs = Date.now() - new Date(createdAt ?? Date.now()).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const gravity = Math.pow(ageHours + 2, 1.5);
    return (totalLikes * 3 + views) / gravity;
}
