# Data sync & scheduling

The data sync scrapes each league and upserts teams, players, stats and coaches
into Postgres. As of July 2026 the **scheduled** sync is triggered by a
Hostinger cron job that calls `POST /api/cron/sync` — the sync then runs
detached inside the web server process.

## Why an HTTP trigger (and not a CLI cron on the server)

The Hostinger git deploy ships only the **built app** to the server
(`.next/`, runtime `node_modules/`, `server.js`); the repo, `pnpm` and `tsx`
do not exist there, so a shell cron cannot run `pnpm sync` on the host. The
HTTP route runs the exact same per-league pipeline as the CLI
(`src/lib/sync/run.ts`), including the season window skip, and responds `202`
immediately so the cron's curl never holds a long connection — the sync
continues in the server process and its progress lands in `sync_runs`
(visible in `/admin#sync`).

The CLI (`pnpm sync:*`) remains the tool for **local / ad-hoc** runs from a
machine that has the repo (it loads `.env` itself), and would be the entry
point again if the sync ever moves to a dedicated worker machine.

## Integrity guarantees

- **Quality gate** — a broken scrape is blocked before any write, so good data is
  never overwritten (`src/lib/sync/quality-gate.ts`).
- **Per-league transaction** — all of a league's writes commit together or
  roll back together; a cancel or error never leaves the DB half-synced.
- **FEB↔top guard** — a FEB (LEB/EBA) namesake is never fused into an ACB / EL /
  NBA professional (`src/lib/leagues-tier.ts`).
- **Single-flight** — an in-process lock plus a `sync_runs` DB guard stop two
  syncs running at once (cron, admin panel and CLI all share the guard).

## Running it manually

```bash
pnpm sync                 # all sources (in-season only)
pnpm sync:elite           # nba acb euroleague
pnpm sync:feb             # Primera FEB / Segunda FEB / Tercera FEB
pnpm sync:nba             # a single source
pnpm sync nba acb --force # ignore the off-season skip (backfill)
```

Or remotely against production (starts detached, returns 202):

```bash
curl -fsS -m 60 -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://globalhoopstats.es/api/cron/sync?sources=nba,acb&force=1"
```

## Per-source cadence (Hostinger cron)

Sources change at very different rates and the polite scraper is a fragile asset
(a ban ends the data). So schedule each cadence group separately and stagger the
times — never one nightly monolith.

| Group | Sources | Schedule |
|-------|---------|----------|
| Elite | `nba,acb,euroleague` | nightly at 05:00 |
| FEB feeders | `leb-oro,leb-plata,eba` | weekly, Mondays at 06:00 |

In **hPanel → Advanced → Cron Jobs** the two jobs are:

```cron
0 5 * * *  curl -fsS -m 60 -X POST -H @/home/<USER>/.cron-auth.hdr https://globalhoopstats.es/api/cron/sync?sources=nba,acb,euroleague
0 6 * * 1  curl -fsS -m 60 -X POST -H @/home/<USER>/.cron-auth.hdr https://globalhoopstats.es/api/cron/sync?sources=leb-oro,leb-plata,eba
```

`~/.cron-auth.hdr` contains the line `X-Cron-Secret: <CRON_SECRET>` and is
written (mode 0600) by the app itself on boot from its own env
(`src/instrumentation.ts`), so the secret never appears in the inspectable
cron command. After changing `CRON_SECRET` in the app's env, a restart
refreshes the file. The `X-Cron-Secret` header exists because Hostinger's
cron UI mangles quoted arguments and `Authorization: Bearer <token>` cannot
be written without quotes; both headers are accepted, and the secret is never
accepted via the query string (it would leak into access logs).

## Off-season handling

A scheduled run skips any source out of its competition window
(`src/lib/sync/season-window.ts`) and reports it in the response as
`skippedOffSeason`. The windows are generous (they include playoffs/finals);
off-season is essentially July–August (NBA also sleeps in September). Pass
`force=1` (HTTP) or `--force` (CLI) to override.

## Observability

- `sync_runs` records every run (source, status, rows, error). The admin panel
  (`/admin#sync`) shows history and live status.
- Stale `running` rows (a crashed run) are swept after 45 min on the next sync,
  or manually with `pnpm db:cleanup-syncs [minutes]` (`0` = close all).
- Hostinger's cron panel keeps the output of the last cron execution
  (hPanel → Advanced → Cron Jobs); a `curl` failure shows up there.

## Future scaling levers (not yet done)

- **Advisory lock** — replace the `sync_runs` overlap guard with
  `pg_try_advisory_lock()` for true mutual exclusion if the app ever runs more
  than one instance.
- **Dedicated worker** — move the sync to its own machine and switch the cron
  back to the CLI (`pnpm sync …`); the pipeline code is shared, so nothing
  else changes.
- **Incremental ingest** — scrape only recent games instead of rebuilding the
  whole season; the real lever once league count grows.
