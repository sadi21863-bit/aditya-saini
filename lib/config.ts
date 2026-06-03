export const QUOTA_CONFIG = {
  // Fraction of daily TPD budget reserved per feature. Must sum to <= 1.0.
  // Remaining 5% is buffer against measurement lag.
  AI_LAB_BUDGET_FRACTION:      0.65,
  QUICK_DEBATE_BUDGET_FRACTION: 0.30,

  // Absolute daily token limit. Set GROQ_DAILY_TPD_LIMIT in env to override.
  // Default 500,000 is a conservative estimate for Groq free tier.
  DAILY_TPD_LIMIT: process.env.GROQ_DAILY_TPD_LIMIT
    ? parseInt(process.env.GROQ_DAILY_TPD_LIMIT, 10)
    : 500_000,
} as const;
