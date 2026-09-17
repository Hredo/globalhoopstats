-- Season-scoped coaching staff — STEP 2 of 2. Run AFTER the new code is live.
--
-- Order, back to back, before the next scheduled sync (the daily cron):
--   1. confirm the deploy that carries the season model is serving;
--   2. `pnpm db:rollover-season --dry`, read the report, then without --dry
--      (it fills `coaches.season_id`, folds EuroLeague "E2025" into "2025-26"
--      and makes the current season the only `is_current` one);
--   3. this file.
--
-- Why not earlier:
-- - The OLD code upserts coaches on (team_id, league_id, slug) and never sets
--   `season_id`. With the key below, every one of its syncs would insert a
--   null-season duplicate of the whole staff instead of updating it.
-- - The OLD code also reads `seasons.is_current`, so the rollover — which hands
--   that flag to the new, still-empty season — would blank parts of the live
--   site if it ran before the deploy.
-- - Swapping the key while null-season rows remain would let the new sync add
--   season-stamped rows NEXT TO the null ones, which the app shows for every
--   season: every coach twice. The rollover leaves no null rows behind.
--
-- The swap cannot fail on existing data: rows unique on (team, league, slug)
-- stay unique once `season_id` is added to the key.

-- The same coach at the same club in two seasons is two rows, and that is the
-- point.
ALTER TABLE `coaches` DROP INDEX `coaches_team_role_idx`;

ALTER TABLE `coaches`
  ADD UNIQUE INDEX `coaches_team_role_idx` (`team_id`, `league_id`, `season_id`, `slug`);
