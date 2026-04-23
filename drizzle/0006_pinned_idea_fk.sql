-- Fix 4 from audit-fixes-april-2026
-- Add FK constraint to rooms.pinned_idea_id so orphaned UUIDs are auto-cleaned
-- when the referenced idea is deleted.

-- Step 1: Clean any orphaned pinned_idea_id values that no longer point to real ideas.
UPDATE rooms
SET pinned_idea_id = NULL
WHERE pinned_idea_id IS NOT NULL
  AND pinned_idea_id NOT IN (SELECT id FROM ideas);

-- Step 2: Add the FK constraint with ON DELETE SET NULL so deleting an idea
-- cleans up the pin automatically instead of leaving a stale reference.
ALTER TABLE rooms
  ADD CONSTRAINT rooms_pinned_idea_id_ideas_id_fk
  FOREIGN KEY (pinned_idea_id) REFERENCES ideas(id)
  ON DELETE SET NULL;
