/**
 * "How would he do one level up?" — the pure half of the projection.
 *
 * Learned, not assumed: for a pair of leagues we take every player who played a
 * season in the lower one and the next season in the higher one, and measure
 * how each per-40 rate changed. The median of those ratios is the translation
 * factor. Medians, because a handful of breakouts or injuries must not move it.
 *
 * When a pair has too few movers to learn from — and FEB → ACB/EuroLeague/NBA
 * has none by construction, since a FEB record is never the same person as a
 * top-tier one (leagues-tier.ts) — the model falls back to the league-strength
 * ratio the market already uses, and says so.
 */
import { median, minutesPerGame, type RawLine } from "@/lib/scouting/metrics"

export const PROJECTED_KEYS = ["pts", "reb", "ast", "stl", "blk"] as const
export type ProjectedKey = (typeof PROJECTED_KEYS)[number]

/** Movers needed before the learned factors are trusted over the model. */
export const MIN_TRANSITIONS = 8

export type Transition = { from: RawLine; to: RawLine }

export type Factors = {
  method: "transitions" | "model"
  /** Movers the factors were learned from (0 for the model). */
  sample: number
  /** Multiplier on each per-40 rate. */
  rate: Record<ProjectedKey, number>
  /** Multiplier on minutes per game: a step up usually costs playing time. */
  minutes: number
  /** Multiplier on true shooting (efficiency drops against better defence). */
  efficiency: number
}

const TOTAL: Record<ProjectedKey, keyof RawLine> = {
  pts: "pointsTotal",
  reb: "reboundsTotal",
  ast: "assistsTotal",
  stl: "stealsTotal",
  blk: "blocksTotal",
}

function per40(line: RawLine, key: ProjectedKey): number | null {
  const total = line[TOTAL[key]] as number | null
  if (total == null || line.minutesTotal == null || line.minutesTotal <= 0) return null
  return (total / line.minutesTotal) * 40
}

function ts(line: RawLine): number | null {
  if (line.pointsTotal == null || line.fgAttempted == null || line.ftAttempted == null) return null
  const d = 2 * (line.fgAttempted + 0.44 * line.ftAttempted)
  return d > 0 ? line.pointsTotal / d : null
}

/** Ratios outside this band are data errors (a 4-minute season), not signal. */
const SANE = (r: number) => Number.isFinite(r) && r > 0.2 && r < 5

export function learnFactors(transitions: readonly Transition[]): Factors | null {
  const usable = transitions.filter(
    (t) =>
      t.from.gamesPlayed >= 10 &&
      t.to.gamesPlayed >= 10 &&
      (minutesPerGame(t.from) ?? 0) >= 8 &&
      (minutesPerGame(t.to) ?? 0) >= 8,
  )
  if (usable.length < MIN_TRANSITIONS) return null

  const rate = {} as Record<ProjectedKey, number>
  for (const key of PROJECTED_KEYS) {
    const ratios = usable
      .map((t) => {
        const a = per40(t.from, key)
        const b = per40(t.to, key)
        return a && b != null ? b / a : null
      })
      .filter((r): r is number => r != null && SANE(r))
    rate[key] = median(ratios) ?? 1
  }
  const minutes =
    median(
      usable
        .map((t) => (minutesPerGame(t.to) ?? 0) / (minutesPerGame(t.from) || 1))
        .filter(SANE),
    ) ?? 1
  const efficiency =
    median(
      usable
        .map((t) => {
          const a = ts(t.from)
          const b = ts(t.to)
          return a && b ? b / a : null
        })
        .filter((r): r is number => r != null && SANE(r)),
    ) ?? 1

  return { method: "transitions", sample: usable.length, rate, minutes, efficiency }
}

/**
 * League-strength fallback. `strengthRatio` = from / to strength (see
 * market/league-strength.ts). Square-root damped like translateRate(); minutes
 * shrink with the same ratio when stepping up and never grow past +15 % when
 * stepping down.
 */
export function modelFactors(strengthRatio: number): Factors {
  const r = Math.sqrt(Math.max(0.05, strengthRatio))
  const rate = Object.fromEntries(PROJECTED_KEYS.map((k) => [k, r])) as Record<ProjectedKey, number>
  return {
    method: "model",
    sample: 0,
    rate,
    minutes: Math.min(1.15, r),
    efficiency: Math.min(1.05, 0.5 + r / 2),
  }
}

export type Projection = {
  minutesPerGame: number | null
  perGame: Record<ProjectedKey, number | null>
  trueShooting: number | null
}

export function project(line: RawLine, f: Factors): Projection {
  const mpg = minutesPerGame(line)
  // A role cannot exceed a full game, whatever the multiplier says.
  const projectedMpg = mpg == null ? null : Math.min(38, mpg * f.minutes)
  const perGame = {} as Record<ProjectedKey, number | null>
  for (const key of PROJECTED_KEYS) {
    const rate = per40(line, key)
    perGame[key] =
      rate == null || projectedMpg == null ? null : (rate * f.rate[key] * projectedMpg) / 40
  }
  const t = ts(line)
  return {
    minutesPerGame: projectedMpg,
    perGame,
    trueShooting: t == null ? null : Math.min(0.75, t * f.efficiency),
  }
}

/** Actual per-game production of a line, in the same shape as a projection. */
export function actual(line: RawLine): Projection {
  const g = line.gamesPlayed
  const perGame = {} as Record<ProjectedKey, number | null>
  for (const key of PROJECTED_KEYS) {
    const total = line[TOTAL[key]] as number | null
    perGame[key] = total == null || g <= 0 ? null : total / g
  }
  return { minutesPerGame: minutesPerGame(line), perGame, trueShooting: ts(line) }
}
