-- Phase 4: Add simHash column for similarity detection
ALTER TABLE "ideas" ADD COLUMN "sim_hash" text;

-- Optional: Create index for faster similarity lookups
CREATE INDEX IF NOT EXISTS "idx_ideas_simhash" ON "ideas" ("sim_hash");
