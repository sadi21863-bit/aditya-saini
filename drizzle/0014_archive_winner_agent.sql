-- Migration 0014: add winner_agent_id to ai_lab_archives
-- Populated when the daily archive is written by the Archivist.
-- Nullable — only set once the archivist identifies a strongest voice.
ALTER TABLE "ai_lab_archives"
  ADD COLUMN IF NOT EXISTS "winner_agent_id" text
    REFERENCES "users"("id") ON DELETE SET NULL;
