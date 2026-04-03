-- ============================================================================
-- IdeaConnect v15 Migration: Rooms Pivot
-- 
-- IMPORTANT: Back up your database before running this migration.
-- This drops tables, columns, and creates new structures.
-- 
-- Run with: npx drizzle-kit push
-- Or execute this SQL directly against your Neon database.
-- ============================================================================

-- ─── STEP 1: DROP DEAD TABLES ───────────────────────────────────────────────

DROP TABLE IF EXISTS prior_art_claims CASCADE;
DROP TABLE IF EXISTS challenge_submissions CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS xp_events CASCADE;
DROP TABLE IF EXISTS genesis_hashes CASCADE;
DROP TABLE IF EXISTS ai_queue CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;

-- ─── STEP 2: CREATE NEW TABLES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  cover_image  TEXT,
  creator_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility   TEXT NOT NULL DEFAULT 'private',
  max_members  INTEGER NOT NULL DEFAULT 8,
  status       TEXT NOT NULL DEFAULT 'active',
  pinned_idea_id UUID,
  created_at   TIMESTAMP DEFAULT now(),
  updated_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_room_member
  ON room_members(room_id, user_id);

CREATE TABLE IF NOT EXISTS room_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  inviter_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT now(),
  expires_at  TIMESTAMP
);

-- Bookmarks table (replaces any old bookmark structure)
CREATE TABLE IF NOT EXISTS bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_bookmark
  ON bookmarks(user_id, target_type, target_id);

-- ─── STEP 3: ADD room_id TO IDEAS ──────────────────────────────────────────

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;

-- ─── STEP 4: CREATE PERSONAL ROOMS FOR EXISTING USERS ──────────────────────
-- (Only needed if you have existing users — safe to run regardless)

INSERT INTO rooms (id, name, description, creator_id, visibility, status)
SELECT
  gen_random_uuid(),
  '@' || handle || '''s workspace',
  'Personal idea workspace',
  id,
  'private',
  'active'
FROM users
WHERE handle IS NOT NULL
  AND id NOT IN (SELECT creator_id FROM rooms);

-- Add owners to room_members for personal rooms
INSERT INTO room_members (id, room_id, user_id, role)
SELECT
  gen_random_uuid(),
  r.id,
  r.creator_id,
  'owner'
FROM rooms r
WHERE NOT EXISTS (
  SELECT 1 FROM room_members rm
  WHERE rm.room_id = r.id AND rm.user_id = r.creator_id
);

-- Assign orphaned ideas to their creator's personal room
UPDATE ideas
SET room_id = (
  SELECT r.id FROM rooms r WHERE r.creator_id = ideas.user_id LIMIT 1
)
WHERE room_id IS NULL AND user_id IS NOT NULL;

-- ─── STEP 5: DROP DEAD COLUMNS FROM IDEAS ──────────────────────────────────

ALTER TABLE ideas DROP COLUMN IF EXISTS ip_protected;
ALTER TABLE ideas DROP COLUMN IF EXISTS genesis_hash;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_metadata;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_summary;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_status;
ALTER TABLE ideas DROP COLUMN IF EXISTS ai_queued_at;
ALTER TABLE ideas DROP COLUMN IF EXISTS editors_pick;
ALTER TABLE ideas DROP COLUMN IF EXISTS remixed_from_id;
ALTER TABLE ideas DROP COLUMN IF EXISTS domain;

-- ─── STEP 6: DROP DEAD COLUMNS FROM USERS ──────────────────────────────────

ALTER TABLE users DROP COLUMN IF EXISTS xp;
ALTER TABLE users DROP COLUMN IF EXISTS private_xp;
ALTER TABLE users DROP COLUMN IF EXISTS public_xp;
ALTER TABLE users DROP COLUMN IF EXISTS tier;
ALTER TABLE users DROP COLUMN IF EXISTS badges;
ALTER TABLE users DROP COLUMN IF EXISTS allow_remix;
ALTER TABLE users DROP COLUMN IF EXISTS pinned_idea_ids;

-- ─── STEP 7: SIMPLIFY NOTIFICATIONS ────────────────────────────────────────

ALTER TABLE notifications DROP COLUMN IF EXISTS domain;
ALTER TABLE notifications DROP COLUMN IF EXISTS actionable;
ALTER TABLE notifications DROP COLUMN IF EXISTS action_payload;

-- ─── STEP 8: UPDATE REPORTS SCHEMA ─────────────────────────────────────────
-- Old reports had 'domain' column. New schema uses 'target_type'.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'idea';

-- Migrate old domain values to target_type if domain column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'reports' AND column_name = 'domain') THEN
    UPDATE reports SET target_type = 'idea' WHERE target_type IS NULL OR target_type = '';
    ALTER TABLE reports DROP COLUMN domain;
  END IF;
END $$;

-- ─── DONE ──────────────────────────────────────────────────────────────────
-- Verify: SELECT count(*) FROM rooms;
-- Verify: SELECT count(*) FROM room_members;
-- Verify: SELECT count(*) FROM ideas WHERE room_id IS NOT NULL;
