import { computeFeedScore } from "@/lib/feed-score";

interface ScoredIdea {
    idea: {
        id: string;
        title: string;
        context: string | null;
        category: string | null;
        totalLikes: number;
        views: number;
        createdAt: Date | null;
        userId: string | null;
    };
    author: {
        name: string | null;
        handle: string | null;
        tier: string | null;
    } | null;
}

/**
 * Picks the same idea all day using a date-seeded index.
 * Candidate pool = top 20 by feed score, must be at least 1 day old.
 */
export function pickIdeaOfTheDay<T extends ScoredIdea>(ideas: T[]): T | null {
    // Only consider ideas older than 24h
    const oneDayAgo = Date.now() - 1000 * 60 * 60 * 24;
    const eligible = ideas.filter(
        (r) => r.idea.createdAt && new Date(r.idea.createdAt).getTime() < oneDayAgo
    );

    if (eligible.length === 0) return null;

    // Sort by score, take top 20 as candidates
    const top20 = [...eligible]
        .sort(
            (a, b) =>
                computeFeedScore(b.idea.totalLikes, b.idea.views, b.idea.createdAt) -
                computeFeedScore(a.idea.totalLikes, a.idea.views, a.idea.createdAt)
        )
        .slice(0, 20);

    // Date seed: YYYYMMDD as number → stable all day
    const today = new Date();
    const seed =
        today.getFullYear() * 10000 +
        (today.getMonth() + 1) * 100 +
        today.getDate();

    const index = seed % top20.length;
    return top20[index];
}
