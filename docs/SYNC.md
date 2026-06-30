# Data sync & scheduling

The data sync scrapes each league and upserts teams, players, stats and coaches
into Postgres. As of June 2026 it runs as a **separate process** (the CLI),
triggered by an **external Hostinger cron job** — not inside the web server.

## Why a separate process

Running the scrape inside the Next.js server tied it to request traffic and meant
a deploy or restart could kill a sync mid-run. The sync now runs standalone via
`scripts/sync.ts`, so:

- a deploy/restart never interrupts a sync,
- the long (polite, slow) scrape never competes with the web event loop,
- the worker can later move to its own machine with zero code changes.

There is exactly **one automatic trigger**: the Hostinger cron below. The old
in-process scheduler was removed. `POST /api/cron/sync` still exists but is now
only a **manual/remote** trigger (it runs the sync in the web process) — do not
schedule it.

## Integrity guarantees

- **Quality gate** — a broken scrape is blocked before any write, so good data is
  never overwritten (`src/lib/sync/quality-gate.ts`).
- **Per-league transaction** (CLI) — all of a league's writes commit together or
  roll back together; a cancel or error never leaves the DB half-synced.
- **FEB↔top guard** — a FEB (LEB/EBA) namesake is never fused into an ACB / EL /
  NBA professional (`src/lib/leagues-tier.ts`).
- **Single-flight** — `flock` in the cron wrapper + a `sync_runs` DB guard stop
  two syncs running at once.

## Running it manually

```bash
pnpm sync                 # all sources (in-season only)
pnpm sync:elite           # nba acb euroleague
pnpm sync:feb             # Primera FEB / Segunda FEB / Tercera FEB
pnpm sync:nba             # a single source
pnpm sync nba acb --force # ignore the off-season skip (backfill)
```

The CLI loads `.env` / `.env.local` itself, so it works straight from a terminal.

## Per-source cadence (Hostinger cron)

Sources change at very different rates and the polite scraper is a fragile asset
(a ban ends the data). So schedule each cadence group separately and stagger the
times — never one nightly monolith.

| Group | Sources | Suggested schedule |
|-------|---------|--------------------|
| Elite | `nba acb euroleague` | nightly |
| FEB feeders | `leb-oro leb-plata eba` | weekly (heavy scrape, slow data) |

In **hPanel → Advanced → Cron Jobs**, add (replace `USER`/`APP` with real paths):

```cron
# Elite leagues — nightly at 05:00
0 5 * * *  /bin/bash /home/USER/htdocs/APP/scripts/cron-sync.sh nba acb euroleague

# FEB feeder divisions — Mondays at 06:00
0 6 * * 1  /bin/bash /home/USER/htdocs/APP/scripts/cron-sync.sh leb-oro leb-plata eba
```

`cron-sync.sh` resolves the project root, fixes `PATH`, takes the `flock`, logs to
`logs/sync-YYYYMMDD.log`, and runs `pnpm sync <sources>`. If `pnpm` is not found,
set `PNPM_BIN` in the cron line: `PNPM_BIN=/path/to/pnpm/dir /bin/bash …`.

## Off-season handling

A scheduled run skips any source out of its competition window
(`src/lib/sync/season-window.ts`) and logs `⏭ skip <source> — off-season`. The
windows are generous (they include playoffs/finals); off-season is essentially
July–August (NBA also sleeps in September). Pass `--force` to override.

## Observability

- `sync_runs` records every run (source, status, rows, error). The admin panel
  (`/admin#sync`) shows history and live status.
- Stale `running` rows (a crashed run) are swept after 45 min on the next sync,
  or manually with `pnpm db:cleanup-syncs [minutes]` (`0` = close all).
- The cron wrapper's per-day log file is the first place to look for a failed run.

## Future scaling levers (not yet done)

- **Advisory lock** — replace the `sync_runs` overlap guard with
  `pg_try_advisory_lock()` for true mutual exclusion if the app ever runs more
  than one instance.
- **Incremental ingest** — scrape only recent games instead of rebuilding the
  whole season; the real lever once league count grows.
