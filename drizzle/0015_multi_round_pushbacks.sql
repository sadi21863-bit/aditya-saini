-- Migration 0015: Multi-round debate support
-- Adds max_rounds, pushback_count, max_pushbacks, winner_id to debates table.
-- Creates debate_pushbacks table for user pushback tracking.

ALTER TABLE "debates" ADD COLUMN "max_rounds" integer NOT NULL DEFAULT 3;
ALTER TABLE "debates" ADD COLUMN "pushback_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "debates" ADD COLUMN "max_pushbacks" integer NOT NULL DEFAULT 3;
ALTER TABLE "debates" ADD COLUMN "winner_id" text;

CREATE TABLE IF NOT EXISTS "debate_pushbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "debate_id" uuid NOT NULL REFERENCES "debates"("id") ON DELETE CASCADE,
  "round" integer NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "agent_id" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_debate_pushbacks_debate" ON "debate_pushbacks" ("debate_id", "created_at");
