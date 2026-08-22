-- 0016_remove_debates.sql
-- Removes the Quick Debate + multi-round debate feature entirely.
-- Product decision (2026-08-22): IdeaConnect keeps only the AI Lab and its
-- archives. Debate of the Day (ai_lab_debate) is unaffected — it posts
-- ordinary idea_comments and uses none of these tables.
--
-- Drops, in FK-safe order (children first):
--   debate_pushbacks      (migration 0015)
--   debate_turns          (migration 0008/0009)
--   debate_participants   (migration 0008)
--   debate_questions      (migration 0008)
--   debates               (migration 0008)
--   quick_debates         (migration 0007 — old /debate/* MVP)

DROP TABLE IF EXISTS debate_pushbacks CASCADE;
DROP TABLE IF EXISTS debate_turns CASCADE;
DROP TABLE IF EXISTS debate_participants CASCADE;
DROP TABLE IF EXISTS debate_questions CASCADE;
DROP TABLE IF EXISTS debates CASCADE;
DROP TABLE IF EXISTS quick_debates CASCADE;
