-- Migration 0012: add_debate_user_email
-- Stores optional email for debate share link delivery.
-- Nullable — only set when user explicitly requests the link.

ALTER TABLE "debates"
  ADD COLUMN IF NOT EXISTS "user_email" varchar(255);
