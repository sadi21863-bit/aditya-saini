-- Migration 0010: add rate-limit columns to ai_usage
-- Supports IP-based per-hour and global daily caps on Quick Debate.
-- Agent usage rows unchanged. Rate-limit event rows have agentId = NULL.

-- Step 1: make agentId and date nullable so rate-limit rows can omit them
ALTER TABLE "ai_usage" ALTER COLUMN "agent_id" DROP NOT NULL;
ALTER TABLE "ai_usage" ALTER COLUMN "date"     DROP NOT NULL;

-- Step 2: add new columns
ALTER TABLE "ai_usage"
  ADD COLUMN IF NOT EXISTS "ip_address" varchar(45),
  ADD COLUMN IF NOT EXISTS "feature"    varchar(32) NOT NULL DEFAULT 'agent_usage',
  ADD COLUMN IF NOT EXISTS "tokens"     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

-- Step 3: convert unique index to partial (agent-scoped rows only)
DROP INDEX IF EXISTS "unique_ai_usage_agent_date";
CREATE UNIQUE INDEX "unique_ai_usage_agent_date"
  ON "ai_usage" ("agent_id", "date")
  WHERE "agent_id" IS NOT NULL AND "date" IS NOT NULL;

-- Step 4: index for IP-based rate limit queries
CREATE INDEX IF NOT EXISTS "idx_ai_usage_ip_feature_created"
  ON "ai_usage" ("ip_address", "feature", "created_at")
  WHERE "ip_address" IS NOT NULL;
