import type { SourceId } from "@/lib/sources/types"

/**
 * Per-source "in season" month windows (1 = Jan … 12 = Dec, inclusive).
 *
 * A scheduled sync for a source whose competition is in its off-season is a
 * waste of a polite-scrape budget and a needless ban risk, so the CLI skips it
 * unless `--force` is passed. Windows are intentionally GENEROUS on both ends so
 * a late playoff/Final-Four/finals week is never missed — better to scrape a few
 * dead weeks than to miss real games. Off-season for the European leagues is
 * essentially July–August; the NBA also sleeps in September.
 *
 * If a competition shifts its calendar, widen the window here — this is the one
 * place that encodes it.
 */
const ACTIVE_MONTHS: Record<SourceId, readonly number[]> = {
  // NBA: preseason Oct, Finals into late June.
  nba: [10, 11, 12, 1, 2, 3, 4, 5, 6],
  // EuroLeague: regular season from Sep/Oct, Final Four late May.
  euroleague: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
  // ACB (Liga Endesa): Sep supercup → finals mid-June.
  acb: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
  // FEB feeder divisions: Sep/Oct → playoffs May/June.
  "leb-oro": [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
  "leb-plata": [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
  eba: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
}

/** Whether `source` is within its active competition window on `date`. */
export function isInSeason(source: SourceId, date: Date = new Date()): boolean {
  return ACTIVE_MONTHS[source].includes(date.getMonth() + 1)
}
