-- Season-scoped coaching staff — STEP 1 of 2. Run BEFORE merging/deploying.
--
-- Before this, `coaches` had no season: the unique key was
-- (team_id, league_id, slug), so each new season's sync OVERWROTE the previous
-- season's bench instead of recording a new one. A club's staff had no history
-- and, worse, last season's assistants silently became this season's.
--
-- This step only ADDS the column, its index and its foreign key. It is safe
-- with the code that is live today — that code never names `season_id`, and
-- its inserts simply leave it null — and it is REQUIRED by the new code: every
-- staff query filters on `coaches.season_id`, so deploying without it breaks
-- the homepage, /leagues and every team page ("Unknown column
-- 'coaches.season_id'").
--
-- The unique key is deliberately NOT changed here. The live sync upserts on
-- (team_id, league_id, slug); swap that key now and every run of the old code
-- inserts a null-season duplicate instead of updating. That swap is step 2.
--
-- `season_id` is nullable on purpose: adding a NOT NULL column to a populated
-- table needs a value for every row, and the right value differs per row.
-- Until `scripts/rollover-season.ts` backfills them, the app treats a null
-- season as "belongs to every season", so /coaches never goes blank.
--
-- Apply by pasting into phpMyAdmin (hPanel → Databases), or from a host whose
-- IP the database allows. Run it once: re-running errors with "Duplicate
-- column name", which is harmless.

ALTER TABLE `coaches`
  ADD COLUMN `season_id` varchar(36) NULL AFTER `league_id`;

ALTER TABLE `coaches`
  ADD INDEX `coaches_season_idx` (`season_id`);

-- Cascade so deleting a season cannot leave orphaned staff behind.
ALTER TABLE `coaches`
  ADD CONSTRAINT `coaches_season_id_seasons_id_fk`
  FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE CASCADE;
