/**
 * Own-roster analysis — powers the "release / renewal" operations. Values the
 * user's current squad and splits it into the core worth keeping and the
 * weakest, most expendable pieces (prime release candidates). All grounded in
 * the same valuation model as everything else.
 */
import { getTeamMarketPlayers, type MarketPlayer } from "@/lib/market/pool"

export type RosterAnalysis = {
  /** Highest-impact players — re-sign / build around. */
  keep: MarketPlayer[]
  /** Lowest bang-for-buck — candidates to cut or not renew. */
  release: MarketPlayer[]
  size: number
}

export async function analyzeRoster(
  leagueSlug: string,
  teamId: string,
  opts: { keep?: number; release?: number } = {},
): Promise<RosterAnalysis> {
  const roster = await getTeamMarketPlayers(leagueSlug, teamId)
  const ranked = [...roster].sort((a, b) => b.valuation.rating - a.valuation.rating)

  // Release candidates: weakest first, with age as the tiebreaker (older +
  // low impact = the most natural cut).
  const byCutValue = [...roster].sort((a, b) => {
    const r = a.valuation.rating - b.valuation.rating
    if (Math.abs(r) > 0.5) return r
    return (b.age ?? 0) - (a.age ?? 0)
  })

  return {
    keep: ranked.slice(0, opts.keep ?? 4),
    release: byCutValue.slice(0, opts.release ?? 4),
    size: roster.length,
  }
}
