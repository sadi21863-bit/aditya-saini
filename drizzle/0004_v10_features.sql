-- Users: new v10 columns
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "pinned_idea_ids" text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS "badges" text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Ideas: new v10 columns
ALTER TABLE "ideas"
  ADD COLUMN IF NOT EXISTS "flair" text,
  ADD COLUMN IF NOT EXISTS "remixed_from_id" uuid,
  ADD COLUMN IF NOT EXISTS "editors_pick" boolean NOT NULL DEFAULT false;

-- Bookmarks table
CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_bookmark"
  ON "bookmarks"("user_id", "idea_id");

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "body" text NOT NULL,
  "link" text,
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now()
);
