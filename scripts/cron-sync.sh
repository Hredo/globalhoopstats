#!/usr/bin/env bash
#
# Hostinger cron entrypoint for the data sync. Runs the sync as a SEPARATE
# process from the web server (see docs/SYNC.md), so a deploy/restart never kills
# a sync mid-run and the scrape never competes with request traffic.
#
# Schedule one line per cadence group in hPanel → Advanced → Cron Jobs, e.g.:
#   # elite leagues, nightly at 05:00
#   0 5 * * *  /bin/bash /home/USER/htdocs/APP/scripts/cron-sync.sh nba acb euroleague
#   # FEB feeder divisions, weekly Monday 06:00 (heavy scrape, slow-moving data)
#   0 6 * * 1  /bin/bash /home/USER/htdocs/APP/scripts/cron-sync.sh leb-oro leb-plata eba
#
# Off-season sources are skipped automatically by the CLI (pass --force to
# override). Overlapping runs are prevented by flock here AND the DB guard in
# the sync itself.
set -euo pipefail

# Resolve the project root from this script's location (works from any CWD).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Hostinger cron runs with a minimal PATH. Add the common node/pnpm locations;
# override with PNPM_BIN in the cron line if pnpm lives elsewhere.
export PATH="${PNPM_BIN:-}:$HOME/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin:$PATH"

mkdir -p logs
LOG="logs/sync-$(date +%Y%m%d).log"
ts() { date '+%F %T'; }

# Single-flight: never let two sync processes run at once on this host.
exec 9>"logs/.sync.lock"
if ! flock -n 9; then
  echo "[$(ts)] skip — another sync already holds the lock" >>"$LOG"
  exit 0
fi

echo "[$(ts)] cron-sync start: ${*:-all}" >>"$LOG"
if pnpm sync "$@" >>"$LOG" 2>&1; then
  echo "[$(ts)] cron-sync OK: ${*:-all}" >>"$LOG"
else
  code=$?
  echo "[$(ts)] cron-sync FAILED (exit $code): ${*:-all}" >>"$LOG"
  exit $code
fi
