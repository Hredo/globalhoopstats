/**
 * League-neutral numbers.
 *
 * Per-game totals reward minutes and fast teams: a sixth man on a slow side
 * looks worse than he is, a starter on a run-and-gun side better. Everything
 * scouting compares across players goes through here first:
 *
 *  - per 40 minutes removes the minutes,
 *  - the pace factor rescales counting stats to the league-average tempo,
 *  - percentiles place the result inside the player's own league-season.
 *
 * Pure functions only — the loaders that feed them live in profile.ts.
 */

export type RawLine = {
  gamesPlayed: number
  minutesTotal: number | null
  pointsTotal: number | null
  reboundsTotal: number | null
  assistsTotal: number | null
  stealsTotal: number | null
  blocksTotal: number | null
  fgMade: number | null
  fgAttempted: number | null
  threeMade: number | null
  threeAttempted: number | null
  ftMade: number | null
  ftAttempted: number | null
  per: number | null
}

export const METRIC_KEYS = ["pts", "reb", "ast", "stl", "blk", "ts", "three", "per"] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

/** Counting stats are the ones that scale with minutes and tempo. */
export const COUNTING: ReadonlySet<MetricKey> = new Set(["pts", "reb", "ast", "stl", "blk"])

export type Basis = "perGame" | "per40" | "per40pace"

/** Below this, a per-40 rate is a few garbage-time minutes blown up. */
export const MIN_MINUTES_PER_GAME = 10
/** Below this, a season is a cameo rather than a sample. */
export const MIN_GAMES = 5
/** Three-point attempts below which a percentage is noise. */
export const MIN_THREE_ATTEMPTS = 25

export function minutesPerGame(line: RawLine): number | null {
  if (line.minutesTotal == null || line.gamesPlayed <= 0) return null
  return line.minutesTotal / line.gamesPlayed
}

/** Whether a line is big enough to rank. */
export function qualifies(line: RawLine, basis: Basis): boolean {
  if (line.gamesPlayed < MIN_GAMES) return false
  if (basis === "perGame") return true
  const mpg = minutesPerGame(line)
  return mpg != null && mpg >= MIN_MINUTES_PER_GAME
}

/**
 * League-average pace over the team's pace. Multiplying a counting stat by it
 * gives what the player would produce at the league's average tempo. 1 when
 * either side is unknown (FEB publishes no possessions for most clubs), so a
 * missing pace never distorts anything — it only means no adjustment.
 */
export function paceFactor(
  teamPace: number | null | undefined,
  leaguePace: number | null | undefined,
): number {
  if (!teamPace || !leaguePace || teamPace <= 0 || leaguePace <= 0) return 1
  // Clamp: a corrupt pace must never multiply a line by 3.
  return Math.min(1.25, Math.max(0.8, leaguePace / teamPace))
}

/** True shooting: points per shooting possession, /2. */
export function trueShooting(line: RawLine): number | null {
  const pts = line.pointsTotal
  const fga = line.fgAttempted
  const fta = line.ftAttempted
  if (pts == null || fga == null || fta == null) return null
  const denom = 2 * (fga + 0.44 * fta)
  return denom > 0 ? pts / denom : null
}

export function metricValues(
  line: RawLine,
  basis: Basis,
  pace = 1,
): Record<MetricKey, number | null> {
  const mins = line.minutesTotal
  const rate = (total: number | null): number | null => {
    if (total == null) return null
    if (basis === "perGame") {
      return line.gamesPlayed > 0 ? total / line.gamesPlayed : null
    }
    if (mins == null || mins <= 0) return null
    const per40 = (total / mins) * 40
    return basis === "per40pace" ? per40 * pace : per40
  }
  const threePct =
    line.threeMade != null &&
    line.threeAttempted != null &&
    line.threeAttempted >= MIN_THREE_ATTEMPTS
      ? line.threeMade / line.threeAttempted
      : null
  return {
    pts: rate(line.pointsTotal),
    reb: rate(line.reboundsTotal),
    ast: rate(line.assistsTotal),
    stl: rate(line.stealsTotal),
    blk: rate(line.blocksTotal),
    ts: trueShooting(line),
    three: threePct,
    per: line.per,
  }
}

/**
 * Percentile of `value` inside `population`, 0-100: the share of the field it
 * beats, counting ties as half. Null with fewer than 8 others — a percentile
 * of a five-man sample is not information.
 */
export function percentileOf(value: number, population: readonly number[]): number | null {
  if (population.length < 8) return null
  let below = 0
  let equal = 0
  for (const v of population) {
    if (v < value) below++
    else if (v === value) equal++
  }
  return Math.round(((below + equal / 2) / population.length) * 100)
}

export type PercentileProfile = Record<
  MetricKey,
  { value: number | null; percentile: number | null }
>

/**
 * A player's profile against a league-season field. The player's own line is
 * part of `field` (it is the population he belongs to); it is compared against
 * everyone else.
 */
export function percentileProfile(
  mine: Record<MetricKey, number | null>,
  field: ReadonlyArray<Record<MetricKey, number | null>>,
): PercentileProfile {
  const out = {} as PercentileProfile
  for (const key of METRIC_KEYS) {
    const value = mine[key]
    if (value == null) {
      out[key] = { value: null, percentile: null }
      continue
    }
    const population = field
      .map((f) => f[key])
      .filter((v): v is number => v != null)
    out[key] = { value, percentile: percentileOf(value, population) }
  }
  return out
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
