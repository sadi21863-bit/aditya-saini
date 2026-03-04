-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0002: Vault Feature Columns
-- Apply with: npx drizzle-kit push  OR  run this SQL directly on your DB
-- All statements use IF NOT EXISTS / safe defaults — safe to run on existing DBs
-- ─────────────────────────────────────────────────────────────────────────────

-- ── IDEAS: new columns ───────────────────────────────────────────────────────

-- View counter (cookie-deduped at route level)
ALTER TABLE "ideas"
  ADD COLUMN IF NOT EXISTS "views" integer NOT NULL DEFAULT 0;

-- IP Shield level: 0=open, 1=CSS, 2=JS block, 3=full blur
ALTER TABLE "ideas"
  ADD COLUMN IF NOT EXISTS "blur_level" integer NOT NULL DEFAULT 0;

-- Genesis Hash: set once on first launch, never overwritten
-- SHA-256(idea_id + user_id + launched_at ISO string)
ALTER TABLE "ideas"
  ADD COLUMN IF NOT EXISTS "genesis_hash" text;

-- Verified Contributor IDs: array of Clerk user IDs added by the Genesis Creator
-- No junction table. Array append via SQL array_append().
ALTER TABLE "ideas"
  ADD COLUMN IF NOT EXISTS "contributor_ids" text[] NOT NULL DEFAULT '{}';

-- total_likes already exists; ensure NOT NULL default for safety
-- (no-op if constraint is already correct)
ALTER TABLE "ideas"
  ALTER COLUMN "total_likes" SET DEFAULT 0,
  ALTER COLUMN "total_likes" SET NOT NULL;

-- ── USERS: new columns ───────────────────────────────────────────────────────

-- Lifetime XP. Drives tier calculation.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "xp" integer NOT NULL DEFAULT 0;

-- Score = sum of XP earned from received likes only.
-- Used for leaderboard: ORDER BY score DESC.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "score" integer NOT NULL DEFAULT 0;

-- Standardise existing tier values to the new enum vocabulary
UPDATE "users"
  SET "tier" = 'dreamer'
  WHERE "tier" IN ('Beginner', 'beginner') OR "tier" IS NULL;

-- Ensure tier column has correct default going forward
ALTER TABLE "users"
  ALTER COLUMN "tier" SET DEFAULT 'dreamer',
  ALTER COLUMN "tier" SET NOT NULL;
