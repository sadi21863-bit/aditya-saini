-- ============================================================
-- Migration 0011: strip_non_core_features
-- ============================================================
--
-- DECISION LOG
-- ────────────────────────────────────────────────────────────
-- DROP  room_invites        — no private rooms in stripped product
-- DROP  bookmarks           — removed feature
-- DROP  follows             — no social graph
--
-- KEEP (no changes)
--   users, rooms, room_members, ideas, idea_comments, idea_likes
--   notifications, reports, accounts, sessions, verification_tokens
--   ai_queue, ai_usage, ai_themes, ai_moderation_log
--   ai_lab_archives, ai_lab_rollups, ai_lab_optouts
--   search_cache, quick_debates
--   debates, debate_questions, debate_participants, debate_turns
--
-- CREATE
--   ai_lab_predictions      — Phase 5 daily prediction mechanic
--
-- NOTE: ai_usage columns (ip_address, feature, tokens, created_at)
--       were added in migration 0010. No changes needed here.
-- ============================================================

-- ── 1. Drop tables for removed features ──────────────────────────────

-- room_invites: private room invites — feature removed
DROP TABLE IF EXISTS "room_invites" CASCADE;

-- bookmarks: bookmarking ideas/rooms — feature removed
DROP TABLE IF EXISTS "bookmarks" CASCADE;

-- follows: user-to-user follow graph — feature removed
DROP TABLE IF EXISTS "follows" CASCADE;

-- ── 2. Create ai_lab_predictions ─────────────────────────────────────
-- One row per user per day. userId and agentId both reference users.id
-- (text PK). UNIQUE(userId, themeDate) enforced via partial unique index.

CREATE TABLE IF NOT EXISTS "ai_lab_predictions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "theme_date" date NOT NULL,
  "agent_id"   text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_ai_lab_prediction_user_date"
  ON "ai_lab_predictions" ("user_id", "theme_date");

-- ── Verification queries (run manually after applying) ────────────────
-- Should return 0 rows:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('room_invites', 'bookmarks', 'follows');
--
-- Should return 1 row:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'ai_lab_predictions';
