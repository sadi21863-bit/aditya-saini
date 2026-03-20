export interface BadgeDefinition {
    slug: string;
    name: string;
    emoji: string;
    description: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
    check: (stats: UserStats) => boolean;
}

export interface UserStats {
    xp: number;
    ideasLaunched: number;
    totalLikes: number;
    followers: number;
    peerReviews: number;
    commentsGiven: number;
}

export const BADGE_REGISTRY: BadgeDefinition[] = [
    { slug: "first_spark", name: "First Spark", emoji: "🔥", description: "Launched your first idea", tier: "bronze", check: (s) => s.ideasLaunched >= 1 },
    { slug: "idea_factory", name: "Idea Factory", emoji: "🏭", description: "Launched 5 ideas", tier: "silver", check: (s) => s.ideasLaunched >= 5 },
    { slug: "prolific", name: "Prolific", emoji: "📚", description: "Launched 20 ideas", tier: "gold", check: (s) => s.ideasLaunched >= 20 },
    { slug: "crowd_pleaser", name: "Crowd Pleaser", emoji: "⚡", description: "Received 10 sparks", tier: "bronze", check: (s) => s.totalLikes >= 10 },
    { slug: "viral", name: "Going Viral", emoji: "🌊", description: "Received 100 sparks", tier: "silver", check: (s) => s.totalLikes >= 100 },
    { slug: "legend", name: "Legend", emoji: "🏆", description: "Received 500 sparks", tier: "gold", check: (s) => s.totalLikes >= 500 },
    { slug: "networker", name: "Networker", emoji: "🤝", description: "Gained 10 followers", tier: "bronze", check: (s) => s.followers >= 10 },
    { slug: "influencer", name: "Influencer", emoji: "📡", description: "Gained 100 followers", tier: "silver", check: (s) => s.followers >= 100 },
    { slug: "visionary_tier", name: "Visionary", emoji: "🔭", description: "Reached Visionary tier (500 XP)", tier: "silver", check: (s) => s.xp >= 500 },
    { slug: "architect_tier", name: "Architect", emoji: "🏛️", description: "Reached Architect tier (2000 XP)", tier: "gold", check: (s) => s.xp >= 2000 },
    { slug: "oracle_tier", name: "Oracle", emoji: "🔮", description: "Reached Oracle tier (5000 XP)", tier: "platinum", check: (s) => s.xp >= 5000 },
    { slug: "peer_reviewer", name: "Peer Reviewer", emoji: "🧪", description: "Submitted 3 peer reviews", tier: "bronze", check: (s) => s.peerReviews >= 3 },
    { slug: "truth_seeker", name: "Truth Seeker", emoji: "🔍", description: "Submitted 10 peer reviews", tier: "silver", check: (s) => s.peerReviews >= 10 },
];

export function computeNewBadges(stats: UserStats, currentBadges: string[]): string[] {
    const current = new Set(currentBadges);
    return BADGE_REGISTRY
        .filter((b) => !current.has(b.slug) && b.check(stats))
        .map((b) => b.slug);
}

export function getBadge(slug: string): BadgeDefinition | undefined {
    return BADGE_REGISTRY.find((b) => b.slug === slug);
}

export const BADGE_TIER_STYLES: Record<BadgeDefinition["tier"], string> = {
    bronze: "bg-amber-900/50 text-amber-300 border-amber-700/50",
    silver: "bg-slate-700/50 text-slate-200 border-slate-500/50",
    gold: "bg-yellow-900/50 text-yellow-300 border-yellow-700/50",
    platinum: "bg-violet-900/50 text-violet-200 border-violet-500/50",
};
