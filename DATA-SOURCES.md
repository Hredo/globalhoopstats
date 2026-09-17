# Data sources & sourcing policy

GlobalHoopStats aggregates **publicly available** basketball statistics and
normalizes them into a single cross-league model. This document records where
the data comes from and the principles under which it is collected. It exists
both as internal documentation and as a public good-faith statement (see the
companion crawler page at [`/bot`](src/app/bot/page.tsx)).

## Sources

| League(s) | Source | Method |
| --- | --- | --- |
| NBA | `stats.nba.com`, Basketball-Reference | JSON API + HTML |
| EuroLeague | Basketball-Reference (`/international/euroleague`) | HTML |
| ACB (Liga Endesa) | `acb.com` | HTML |
| Primera FEB · Segunda FEB · Tercera FEB | `baloncestoenvivo.feb.es` (FEB) | HTML (ASP.NET) |

Per-league adapters live in [`src/lib/sources/`](src/lib/sources); each one
normalizes its source into the shared `SourceAdapter` interface
([`types.ts`](src/lib/sources/types.ts)). **All adapters route their HTTP through
the shared polite fetcher** ([`fetcher.ts`](src/lib/sources/fetcher.ts)) — no
adapter calls `fetch` directly.

## Principles

1. **Identifiable, honest crawler.** Every request carries the
   `GlobalHoopStatsBot/1.0 (+https://globalhoopstats.es/bot; …)` User-Agent. We
   do not disguise the crawler as a browser. This signals good faith and keeps
   the door open to official data agreements (FEB → FIBA, etc.).
2. **Low, self-imposed request rate.** Requests to a single host are serialized
   and spaced (`SCRAPER_MIN_HOST_INTERVAL_MS`, default 1200 ms). FEB enrichment
   adds extra jitter on top.
3. **Respect back-pressure.** We honor `Retry-After` and back off on 429/503.
4. **Public data only.** We do not bypass paywalls, authentication or access
   controls; we collect only statistics already published openly.
5. **Add value, don't redistribute raw.** Our product is the cross-league
   unification, context and presentation — not a wholesale copy of any source's
   database. Provenance is attributed.
6. **Prompt opt-out.** Any source operator can reach `data@globalhoopstats.es`
   to throttle, block or discuss access.

## Data-quality gate

Scraped pipelines fail silently when a source changes its markup. The sync
**never overwrites good data with a broken scrape**: before writing, each
league's batch passes through the quality gate
([`quality-gate.ts`](src/lib/sync/quality-gate.ts)), which blocks and alerts on
empty batches, mostly-blank stat lines, or a sharp regression versus the last
good sync. Blocked syncs keep yesterday's correct data and (optionally) page a
webhook.

## Seasons and the rollover

A season has **two names** and conflating them is the bug that split the
EuroLeague off from every other league in the database:

- the **label** (`2026-27`) is what `seasons.name` stores, what the UI shows and
  what every league shares — a season filter is only possible because NBA, ACB,
  EuroLeague and the three FEB divisions land on the same row;
- the **feed code** is whatever the source calls it (`E2026` for the EuroLeague
  feed, `2026-27` for the NBA API, `2026` for the FEB rankings postback) and is
  read only by the adapter that talks to that source.

Both live on the adapter as `seasonLabel` and `seasonCode`; **only the label
ever reaches the database**. Everything derives from one constant,
`CURRENT_SEASON_START_YEAR` in [`src/lib/seasons.ts`](src/lib/seasons.ts).

### Opening a new season

1. Bump `CURRENT_SEASON_START_YEAR`.
2. `pnpm probe:season` — asks every source whether it actually publishes that
   season yet. Competitions open their season pages at different times, so a
   partial pass is normal, not a bug.
The first time (introducing season-scoped staff) the database change comes in
two halves around the deploy, because the code that is live until then upserts
coaches on the old key and reads `seasons.is_current`:

- **Before merging:** apply
  [`scripts/migrations/coaches-season-1-before-deploy.sql`](scripts/migrations/coaches-season-1-before-deploy.sql)
  (adds the nullable `coaches.season_id`; harmless to the old code, required by
  the new one).
- **Right after the deploy, before the next sync:** step 4 below, then
  [`scripts/migrations/coaches-season-2-after-deploy.sql`](scripts/migrations/coaches-season-2-after-deploy.sql)
  (moves `season_id` into the unique key). Do NOT `pnpm db:push` before the
  deploy — it would swap the key while the old sync still depends on it.

3. Once those are in, opening a later season needs no schema change.
4. `pnpm db:rollover-season` — creates the season row, makes `is_current` a
   singleton again, folds legacy `E20xx` seasons into their canonical label and
   backfills `coaches.season_id`. Idempotent; `--dry` reports without writing.
5. Sync the leagues whose sources are ready; re-run the probe for the rest.

### Preseason: squads without statistics

Between a season opening and its first tip-off, clubs have confirmed rosters and
nobody has any numbers. Three things make that work rather than look like a
broken scrape:

- the quality gate **allows a stat-free batch** when the league+season has no
  stored rows yet (a genuine preseason load), while still blocking one that
  arrives after the season has data;
- the sync writes a **roster row** (`games_played = 0`) for every squad member
  with no stat line, because rosters are read out of `player_season_stats`;
- adapters treat a **404 on a season page as "not published yet"** and return
  nothing instead of aborting the league.

### Departures

Each sync reconciles the season it just scraped: a `(player, team)` pair stored
for that league and season but absent from the scrape is deleted, so a player
who left a club stops appearing on it **for that season only**. Previous seasons
are history and are never touched, which is what keeps "2025-26 · Real Madrid"
on a profile after a transfer. Careers cross competitions, so the same player
can be in one league one season and another the next; the profile follows the
most recent season, not the league they have played most games in.

Pruning deletes rows, so it needs a stronger signal than the quality gate: below
`MIN_PAIRS_TO_PRUNE` scraped pairs the reconciliation is skipped and logged.
Stale squad members are recoverable; a wiped roster is not.

## Legal note

In the EU, compilations of data can attract the *sui generis database right*
(Directive 96/9/EC) even when the individual facts are not themselves
copyrightable. The principles above (public data only, attribution, value-add,
low rate, honest identification, prompt opt-out) are designed to keep collection
responsible and to support a transition to **official, licensed access** as
partnerships are established. This document is not legal advice.
