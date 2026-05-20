-- 0007_quick_debates.sql
-- Adds: quick_debates table, is_ephemeral column on rooms

-- Add is_ephemeral flag to rooms so Quick Debate backing rooms can be
-- tagged for cleanup without disrupting normal room queries.
ALTER TABLE "rooms"
  ADD COLUMN "is_ephemeral" boolean NOT NULL DEFAULT false;

-- Create quick_debates table for the Quick Debate flow.
-- Each row represents one user-submitted idea that goes through the
-- fast Llama→GPT-OSS debate pipeline. Backed by a private ephemeral room.
CREATE TABLE "quick_debates" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_text"     text NOT NULL,
  "submitted_by"  text NOT NULL,
  "room_id"       uuid,
  "share_token"   text UNIQUE,
  "status"        text NOT NULL DEFAULT 'queued',
  "narrative_arc" text,
  "error_message" text,
  "created_at"    timestamp DEFAULT now() NOT NULL,
  "completed_at"  timestamp
);

ALTER TABLE "quick_debates"
  ADD CONSTRAINT "quick_debates_submitted_by_users_id_fk"
  FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id")
  ON DELETE CASCADE;

ALTER TABLE "quick_debates"
  ADD CONSTRAINT "quick_debates_room_id_rooms_id_fk"
  FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id")
  ON DELETE SET NULL;
