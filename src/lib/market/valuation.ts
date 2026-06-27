/**
 * Player valuation — turns a season stat line + context into an estimated
 * market value and salary, in EUR. This is the single comparable scalar the
 * rest of the market layer (similarity ranking, trade balancing, advisor
 * recommendations) relies on.
 *
 * It is a transparent heuristic, NOT scraped salary data. Every component is
 * exposed in `Valuation.components` so the number can be explained and audited.
 * Anchored to per-league ceilings from league-strength.ts.
 */
import { leagueEconomics, leagueStrength } from "@/lib/market/league-strength"

export type MarketStatLine = {
  gamesPlayed: number
  minutesTotal: number | null
  pointsTotal: number | null
  reboundsTotal: number | null
  assistsTotal: number | null
  stealsTotal: number | null
  blocksTotal: number | null
  fgPct: number | null
  threePct: number | null
  ftPct: number | null
  per: number | null
  trueShootingPct: number | null
  winShares: number | null
  bpm: number | null
}

export type ValuationTier =
  | "franchise"
  | "starter"
  | "rotation"
  | "role"
  | "fringe"

export type Valuation = {
  /** Estimated transfer/market value (EUR). */
  eur: number
  /** Estimated annual salary (EUR). */
  annualEur: number
  tier: ValuationTier
  /** League context for this tier (tiers are relative within each league). */
  leagueSlug: string
  confidence: "high" | "medium" | "low"
  /** Normalised 0..100 production+impact rating. */
  rating: number
  components: {
    production: number
    efficiency: number
    ageFactor: number
    leagueFactor: number
    scarcity: number
  }
}

export type ValuationInput = {
  stats: MarketStatLine | null
  leagueSlug: string | null | undefined
  position: string | null
  /** Age in years, if derivable from birthdate. */
  age: number | null
}

function perGame(total: number | null | undefined, gp: number): number {
  if (total == null || !Number.isFinite(total) || gp <= 0) return 0
  return total / gp
}

/**
 * Age multiplier. Resale value peaks in the mid-20s; youth carries an upside
 * premium (clubs pay for projection), veterans decline.
 */
function ageFactor(age: number | null): number {
  if (age == null) return 1
  if (age <= 19) return 1.12
  if (age <= 23) return 1.12 - (age - 19) * 0.02 // 1.12 → 1.04
  if (age <= 28) return 1.0
  if (age <= 32) return 1.0 - (age - 28) * 0.07 // 1.0 → 0.72
  return Math.max(0.45, 0.72 - (age - 32) * 0.06)
}

/** Mild positional scarcity: lead guards and true bigs cost a touch more. */
function scarcityFactor(position: string | null): number {
  const p = (position ?? "").toUpperCase()
  if (p.startsWith("C") || p.startsWith("5")) return 1.08
  if (p.startsWith("PG") || p.startsWith("1") || p === "G") return 1.06
  return 1.0
}

/**
 * Map a normalized 0-100 rating to a tier. The rating is already adjusted by
 * league strength (see computeRating), so thresholds are fixed. A player's
 * tier is always relative to their own league context.
 */
function tierFor(rating: number): ValuationTier {
  if (rating >= 78) return "franchise"
  if (rating >= 60) return "starter"
  if (rating >= 42) return "rotation"
  if (rating >= 25) return "role"
  return "fringe"
}

/**
 * Core talent/production rating, 0..100, normalised by league strength.
 * Box-score creation on a per-game basis, adjusted by whatever advanced metrics
 * are available (TS%, PER, BPM, Win Shares). The raw absolute rating is then
 * divided by sqrt(leagueStrength) so a player's standing within their own league
 * is reflected on the 0–100 scale regardless of the league's absolute stat level.
 */
function computeRating(stats: MarketStatLine, leagueSlug?: string): {
  rating: number
  production: number
  efficiency: number
} {
  const gp = stats.gamesPlayed || 1
  const pts = perGame(stats.pointsTotal, gp)
  const reb = perGame(stats.reboundsTotal, gp)
  const ast = perGame(stats.assistsTotal, gp)
  const stl = perGame(stats.stealsTotal, gp)
  const blk = perGame(stats.blocksTotal, gp)

  // Weighted two-way box production. Steals/blocks weighted high (rare, high
  // signal); assists above rebounds (creation premium).
  const production = pts + 1.15 * ast + 0.8 * reb + 2.0 * stl + 2.0 * blk
  // ~35 production = elite; scale into a 0..~70 base.
  const base = Math.min(70, production * 1.9)

  // Efficiency adjustments, all centred on a neutral baseline.
  const ts = stats.trueShootingPct
  const tsAdj = ts != null ? (ts - 0.55) * 55 : 0
  const perAdj = stats.per != null ? (stats.per - 15) * 0.7 : 0
  const bpmAdj = stats.bpm != null ? stats.bpm * 1.4 : 0
  const wsAdj = stats.winShares != null ? stats.winShares * 1.2 : 0
  const efficiency = tsAdj + perAdj + bpmAdj + wsAdj

  const raw = Math.max(0, Math.min(100, base + efficiency))

  // Normalise by league strength so the rating reflects league-relative standing.
  const s = leagueSlug ? Math.sqrt(leagueStrength(leagueSlug)) : 1
  const rating = Math.min(100, raw / Math.max(0.1, s))

  return { rating, production, efficiency }
}

export function estimateValuation(input: ValuationInput): Valuation {
  const econ = leagueEconomics(input.leagueSlug)
  const stats = input.stats

  if (!stats || stats.gamesPlayed <= 0) {
    return {
      eur: 0,
      annualEur: 0,
      tier: "fringe",
      leagueSlug: input.leagueSlug ?? "unknown",
      confidence: "low",
      rating: 0,
      components: {
        production: 0,
        efficiency: 0,
        ageFactor: ageFactor(input.age),
        leagueFactor: econ.strength,
        scarcity: scarcityFactor(input.position),
      },
    }
  }

  const { rating, production, efficiency } = computeRating(stats, input.leagueSlug ?? undefined)
  const age = ageFactor(input.age)
  const scarcity = scarcityFactor(input.position)

  // Convex mapping rating → value so stars are genuinely rare and expensive.
  const curve = Math.pow(rating / 100, 2.1)
  const rawValue = curve * econ.valueCeiling * age * scarcity
  const rawSalary = curve * econ.salaryCeiling * age * scarcity

  // Confidence from sample size and whether minutes are recorded.
  const gp = stats.gamesPlayed
  const confidence: Valuation["confidence"] =
    gp >= 15 ? "high" : gp >= 8 ? "medium" : "low"

  // Round to readable steps.
  const round = (v: number, step: number) => Math.round(v / step) * step
  const valueStep = econ.valueCeiling >= 1_000_000 ? 50_000 : 1_000
  const salaryStep = econ.salaryCeiling >= 1_000_000 ? 50_000 : 1_000

  return {
    eur: Math.max(0, round(rawValue, valueStep)),
    annualEur: Math.max(0, round(rawSalary, salaryStep)),
    tier: tierFor(rating),
    leagueSlug: input.leagueSlug ?? "unknown",
    confidence,
    rating: Math.round(rating),
    components: {
      production: Math.round(production * 10) / 10,
      efficiency: Math.round(efficiency * 10) / 10,
      ageFactor: Math.round(age * 100) / 100,
      leagueFactor: econ.strength,
      scarcity,
    },
  }
}

/** Derive age in whole years from a birthdate string (YYYY-MM-DD or similar). */
export function ageFromBirthdate(
  birthdate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!birthdate) return null
  const d = new Date(birthdate)
  if (Number.isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  if (age < 14 || age > 60) return null
  return age
}

const TIER_LABEL_ES: Record<ValuationTier, string> = {
  franchise: "Jugador franquicia",
  starter: "Titular",
  rotation: "Rotación",
  role: "Jugador de rol",
  fringe: "Fondo de armario",
}

export function valuationTierLabel(tier: ValuationTier, leagueSlug?: string): string {
  const label = TIER_LABEL_ES[tier]
  if (!leagueSlug) return label
  const econ = leagueEconomics(leagueSlug)
  return `${label} — ${econ.label}`
}
