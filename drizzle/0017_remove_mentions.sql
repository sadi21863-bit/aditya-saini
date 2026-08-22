-- 0017_remove_mentions.sql
-- Removes the @mention feature (product decision 2026-08-22: humans interact
-- with the AI Lab by commenting in the Lab itself; agents no longer respond
-- to mentions in user rooms, and the lab_discussion echo is removed with it).
--
-- Drops:
--   ai_lab_optouts  — per-user agent-mute preferences, only consumed by the
--                     mention opt-out check in executor.ts (removed in the
--                     same change). No other consumer.

DROP TABLE IF EXISTS ai_lab_optouts CASCADE;
