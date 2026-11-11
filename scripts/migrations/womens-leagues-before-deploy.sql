-- Women's leagues — run ONCE in phpMyAdmin BEFORE deploying.
--
-- Adds `leagues.gender` ('men' | 'women'). Every league already in the table
-- is a men's competition, which is exactly what the DEFAULT gives them, so no
-- backfill is needed. The three women's leagues (lf-endesa, lf-challenge, lf2)
-- do not exist yet: the first sync that includes them creates their rows with
-- gender = 'women'.
--
-- Must land first: the new code selects this column whenever it reads
-- `leagues`, so deploying before it would 500 every page that lists a league.
-- Safe for the code that is live now — it never names the column, and the
-- DEFAULT covers the league rows its sync upserts.

ALTER TABLE `leagues`
  ADD COLUMN `gender` varchar(8) NOT NULL DEFAULT 'men';
