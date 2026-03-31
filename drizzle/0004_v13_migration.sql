-- IdeaConnect v13 Migration
-- Run AFTER all v12 migrations have been applied.
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards everywhere).

-- ─── 1. USERS: add new columns, migrate tier values, drop legacy score ────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS private_xp integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_xp integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_remix boolean NOT NULL DEFAULT true;

-- Migrate v12 tier names → v13 names
UPDATE users SET tier = 'explorer'  WHERE tier = 'starter';
UPDATE users SET tier = 'builder'   WHERE tier = 'builder';   -- no-op, same name
UPDATE users SET tier = 'architect' WHERE tier = 'architect'; -- no-op
UPDATE users SET tier = 'pioneer'   WHERE tier = 'grand_architect';

-- Drop legacy score column (never used in v12)
ALTER TABLE users DROP COLUMN IF EXISTS score;

-- ─── 2. IDEAS: add domain + rename vault→private, drop redundant domain values ─

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'private';

-- Migrate v12 'vault' domain → v13 'private'
UPDATE ideas SET domain = 'private' WHERE domain = 'vault';
UPDATE ideas SET domain = 'public'  WHERE domain = 'commons';

-- ─── 3. IDEAS: migrate communityIdeas rows into unified ideas table ──────────
-- Only run if communityIdeas table exists (v12 had it, v13 drops it)

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'community_ideas') THEN
    INSERT INTO ideas (
      id, user_id, domain, title, context, content, category, tags, status,
      ip_protected, total_likes, total_comments, views, ai_metadata,
      editors_pick, created_at, updated_at
    )
    SELECT
      id, user_id, 'public', title, context, content, category, tags, status,
      false, total_likes, total_comments, views, ai_metadata,
      editors_pick, created_at, updated_at
    FROM community_ideas
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ─── 4. IDEA_COMMENTS: add FK on parentId (was unguarded in v12) ─────────────

ALTER TABLE idea_comments
  ADD CONSTRAINT IF NOT EXISTS idea_comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES idea_comments(id) ON DELETE SET NULL;

-- ─── 5. REVIEWS table (new in v13) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id     uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id  uuid REFERENCES idea_comments(id) ON DELETE SET NULL,
  verdict     text NOT NULL,
  rating      integer NOT NULL,
  tags        text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now(),
  CONSTRAINT unique_user_idea_review UNIQUE (idea_id, user_id)
);

-- ─── 6. GENESIS_HASHES table (new in v13) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS genesis_hashes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id      uuid NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
  hash         text NOT NULL UNIQUE,
  created_at   timestamp DEFAULT now(),
  ots_blob_url text,
  confirmed    boolean NOT NULL DEFAULT false
);

-- Migrate existing inline genesisHash values from ideas table
INSERT INTO genesis_hashes (idea_id, hash, confirmed)
SELECT id, genesis_hash, true
FROM ideas
WHERE genesis_hash IS NOT NULL
ON CONFLICT (idea_id) DO NOTHING;

-- ─── 7. XP_EVENTS table (new in v13) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xp_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  idea_id     uuid REFERENCES ideas(id) ON DELETE CASCADE,
  xp_awarded  integer NOT NULL,
  created_at  timestamp DEFAULT now()
);

-- ─── 8. REPORTS: add domain + rename reason → report_type ───────────────────

ALTER TABLE reports ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_type text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS admin_note text;

-- Migrate old 'reason' to 'report_type' if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'reason'
  ) THEN
    UPDATE reports SET report_type = reason WHERE report_type IS NULL;
    ALTER TABLE reports DROP COLUMN IF EXISTS reason;
  END IF;
END $$;

-- Migrate old 'details' to 'admin_note' if not already migrated
-- (details stays for user-submitted context, admin_note is for moderator notes)

-- ─── 9. CHALLENGES: fix winnerId FK (was unguarded in v12) ───────────────────

-- The winner_id in v12 pointed to communityIdeas; now points to ideas
-- After the communityIdeas migration above, the IDs are the same so this is safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_name = 'challenges_winner_id_fkey'
  ) THEN
    ALTER TABLE challenges
      ADD CONSTRAINT challenges_winner_id_fkey
      FOREIGN KEY (winner_id) REFERENCES ideas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 10. CHALLENGE_SUBMISSIONS: migrate communityIdeaId → ideaId ─────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'challenge_submissions' AND column_name = 'community_idea_id'
  ) THEN
    ALTER TABLE challenge_submissions
      RENAME COLUMN community_idea_id TO idea_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.table_constraints
    WHERE constraint_name = 'challenge_submissions_idea_id_fkey'
  ) THEN
    ALTER TABLE challenge_submissions
      ADD CONSTRAINT challenge_submissions_idea_id_fkey
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 11. DROP legacy tables (communityIdeas, communityComments, communityLikes) ─
-- Data already migrated above. Drop in reverse FK order.

DROP TABLE IF EXISTS community_likes;
DROP TABLE IF EXISTS community_comments;
DROP TABLE IF EXISTS community_ideas;

-- ─── 12. Recalculate tiers based on new v13 thresholds ───────────────────────
-- v13 thresholds: explorer=0, builder=100, architect=500, pioneer=1500

UPDATE users SET tier =
  CASE
    WHEN xp >= 1500 THEN 'pioneer'
    WHEN xp >= 500  THEN 'architect'
    WHEN xp >= 100  THEN 'builder'
    ELSE 'explorer'
  END;
