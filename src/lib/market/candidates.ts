/**
 * Candidate finder — given a team's league and a need ("intent"), returns REAL
 * players from the database ranked by fit. This is what grounds the AI advisor:
 * instead of the model inventing names from memory (or the old hardcoded star
 * list), it now recommends actual players we have data for, priced and scoped
 * to the same league plus realistic feeder/destination leagues.
 */
import { adjacentLeagueSlugs } from "@/lib/market/league-strength"
import { getMarketPool, type MarketPlayer } from "@/lib/market/pool"
import { matchesNatFilter, type NatFilter } from "@/lib/market/nationality"
import type { Intent } from "@/lib/ai/intent"

export type Candidate = {
  player: MarketPlayer
  fitScore: number
  reason: string
}

export type CandidateQuery = {
  leagueSlug: string
  intent: Intent
  excludeTeamId?: string
  /** Cap candidate market value (EUR) — e.g. to a team's budget. */
  maxValueEur?: number
  /** Cupo / passport requirement (Spanish leagues). */
  nationality?: NatFilter
  /** Age window — e.g. maxAge for draft/youth-development queries. */
  maxAge?: number
  minAge?: number
  /** Minimum games to count as a real sample. */
  minGames?: number
  limit?: number
}

function pg(total: number | null, gp: number): number {
  return total == null || gp <= 0 ? 0 : total / gp
}

type Scored = { score: number; reason: string }

function scoreFor(intent: Intent, p: MarketPlayer): Scored {
  const gp = p.stats.gamesPlayed || 1
  const pts = pg(p.stats.pointsTotal, gp)
  const reb = pg(p.stats.reboundsTotal, gp)
  const ast = pg(p.stats.assistsTotal, gp)
  const stl = pg(p.stats.stealsTotal, gp)
  const blk = pg(p.stats.blocksTotal, gp)
  const three = p.stats.threePct ?? 0
  const ts = p.stats.trueShootingPct ?? 0
  const rating = p.valuation.rating

  switch (intent) {
    case "defender":
      return {
        score: stl * 14 + blk * 14 + reb * 1.5 + rating * 0.3,
        reason: `${stl.toFixed(1)} robos · ${blk.toFixed(1)} tapones por partido`,
      }
    case "scorer":
      return {
        score: pts * 2.2 + three * 25 + ts * 20 + rating * 0.3,
        reason: `${pts.toFixed(1)} pts · ${(three * 100).toFixed(0)}% en triples`,
      }
    case "playmaker":
      return {
        score: ast * 9 + pts * 0.6 + stl * 4 + rating * 0.3,
        reason: `${ast.toFixed(1)} asistencias por partido`,
      }
    case "wing":
      return {
        score: pts * 1.2 + three * 18 + stl * 6 + reb * 1.2 + rating * 0.4,
        reason: `Perfil 3&D: ${pts.toFixed(1)} pts, ${(three * 100).toFixed(0)}% T3, ${stl.toFixed(1)} robos`,
      }
    case "big":
      return {
        score: reb * 4 + blk * 12 + pts * 1.1 + rating * 0.3,
        reason: `${reb.toFixed(1)} rebotes · ${blk.toFixed(1)} tapones por partido`,
      }
    case "cheap":
      // Best production per euro: rating relative to value.
      return {
        score: (rating * rating) / Math.max(40_000, p.valuation.eur),
        reason: `Valor ${p.valuation.tier} a ~${Math.round(p.valuation.eur / 1000)}K — buena relación rendimiento/precio`,
      }
    case "star":
      return {
        score: rating * 2 + pts * 1.2,
        reason: `Rating de impacto ${rating}/100 · ${pts.toFixed(1)} pts`,
      }
    case "general":
    default:
      return {
        score: rating,
        reason: `Rating global ${rating}/100`,
      }
  }
}

/** Position bucket a given intent prefers, or null for any. */
function intentPosition(intent: Intent): "G" | "F" | "C" | null {
  switch (intent) {
    case "playmaker":
      return "G"
    case "wing":
      return "F"
    case "big":
      return "C"
    default:
      return null
  }
}

function bucket(position: string | null): string {
  const p = (position ?? "").toUpperCase()
  if (p.startsWith("PG") || p.startsWith("SG") || p.startsWith("1") || p.startsWith("2") || p === "G")
    return "G"
  if (p.startsWith("SF") || p.startsWith("PF") || p.startsWith("3") || p.startsWith("4") || p === "F")
    return "F"
  if (p.startsWith("C") || p.startsWith("5")) return "C"
  return "?"
}

export async function findCandidates(q: CandidateQuery): Promise<Candidate[]> {
  const leagues = adjacentLeagueSlugs(q.leagueSlug, { includeSelf: true })
  const pool = await getMarketPool(leagues, q.minGames ?? 5)
  const wantPos = intentPosition(q.intent)

  return pool
    .filter((p) => !q.excludeTeamId || p.team?.id !== q.excludeTeamId)
    .filter((p) => q.maxValueEur == null || p.valuation.eur <= q.maxValueEur)
    .filter((p) => wantPos == null || bucket(p.position) === wantPos)
    .filter((p) => !q.nationality || matchesNatFilter(p.nationality, q.nationality))
    .filter((p) => q.maxAge == null || p.age == null || p.age <= q.maxAge)
    .filter((p) => q.minAge == null || p.age == null || p.age >= q.minAge)
    .map((p) => {
      const s = scoreFor(q.intent, p)
      return { player: p, fitScore: s.score, reason: s.reason }
    })
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, q.limit ?? 6)
}
