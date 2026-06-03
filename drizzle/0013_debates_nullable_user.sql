-- Migration 0013: make debates.user_id nullable
-- Quick Debate is anonymous-first. Logged-in users still get userId stored;
-- anonymous users get NULL. History page remains auth-gated.
ALTER TABLE "debates" ALTER COLUMN "user_id" DROP NOT NULL;
