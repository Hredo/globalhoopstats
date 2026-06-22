/**
 * The market "pool": current-season players for a set of leagues, each already
 * priced via the valuation model. Every other market feature (similarity,
 * candidates, trades) reads from here so valuation logic lives in one place.
 */
import { and, eq, gte, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { leagues, playerSeasonStats, players, seasons, teams } from "@/lib/db/schema"
import { cached } from "@/lib/data/cache"
import {
  estimateValuation,
  ageFromBirthdate,
  type MarketStatLine,
  type Valuation,
} from "@/lib/market/valuation"

export type MarketPlayer = {
  id: string
  slug: string
  fullName: string
  position: string | null
  nationality: string | null
  age: number | null
  heightCm: number | null
  imageUrl: string | null
  league: { slug: string; name: string; region: string }
  team: { id: string; slug: string; name: string; logoUrl: string | null } | null
  stats: MarketStatLine
  valuation: Valuation
}

function pct(made: number | null, att: number | null): number | null {
  if (made == null || att == null || att <= 0) return null
  return made / att
}

async function loadPool(
  leagueSlugs: string[],
  minGames: number,
): Promise<MarketPlayer[]> {
  if (leagueSlugs.length === 0) return []
  const db = getDb()

  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      nationality: players.nationality,
      birthdate: players.birthdate,
      heightCm: players.heightCm,
      imageUrl: players.imageUrl,
      leagueSlug: leagues.slug,
      leagueName: leagues.name,
      leagueRegion: leagues.region,
      teamId: teams.id,
      teamSlug: teams.slug,
      teamName: teams.name,
      teamLogo: teams.logoUrl,
      gamesPlayed: playerSeasonStats.gamesPlayed,
      minutesTotal: playerSeasonStats.minutesTotal,
      pointsTotal: playerSeasonStats.pointsTotal,
      reboundsTotal: playerSeasonStats.reboundsTotal,
      assistsTotal: playerSeasonStats.assistsTotal,
      stealsTotal: playerSeasonStats.stealsTotal,
      blocksTotal: playerSeasonStats.blocksTotal,
      fgMade: playerSeasonStats.fgMade,
      fgAttempted: playerSeasonStats.fgAttempted,
      threeMade: playerSeasonStats.threeMade,
      threeAttempted: playerSeasonStats.threeAttempted,
      ftMade: playerSeasonStats.ftMade,
      ftAttempted: playerSeasonStats.ftAttempted,
      per: playerSeasonStats.per,
      trueShootingPct: playerSeasonStats.trueShootingPct,
      winShares: playerSeasonStats.winShares,
      bpm: playerSeasonStats.bpm,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(
      and(
        eq(seasons.isCurrent, true),
        inArray(leagues.slug, leagueSlugs),
        gte(playerSeasonStats.gamesPlayed, minGames),
      ),
    )

  // A player may have rows in several leagues of the set; keep the busiest one.
  const byPlayer = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    const prev = byPlayer.get(r.id)
    if (!prev || (r.gamesPlayed ?? 0) > (prev.gamesPlayed ?? 0)) {
      byPlayer.set(r.id, r)
    }
  }

  const out: MarketPlayer[] = []
  for (const r of byPlayer.values()) {
    const stats: MarketStatLine = {
      gamesPlayed: r.gamesPlayed ?? 0,
      minutesTotal: r.minutesTotal,
      pointsTotal: r.pointsTotal,
      reboundsTotal: r.reboundsTotal,
      assistsTotal: r.assistsTotal,
      stealsTotal: r.stealsTotal,
      blocksTotal: r.blocksTotal,
      fgPct: pct(r.fgMade, r.fgAttempted),
      threePct: pct(r.threeMade, r.threeAttempted),
      ftPct: pct(r.ftMade, r.ftAttempted),
      per: r.per,
      trueShootingPct: r.trueShootingPct,
      winShares: r.winShares,
      bpm: r.bpm,
    }
    const age = ageFromBirthdate(r.birthdate)
    out.push({
      id: r.id,
      slug: r.slug,
      fullName: `${r.firstName} ${r.lastName}`.trim(),
      position: r.position,
      nationality: r.nationality,
      age,
      heightCm: r.heightCm,
      imageUrl: r.imageUrl,
      league: { slug: r.leagueSlug, name: r.leagueName, region: r.leagueRegion },
      team: r.teamId
        ? { id: r.teamId, slug: r.teamSlug!, name: r.teamName!, logoUrl: r.teamLogo }
        : null,
      stats,
      valuation: estimateValuation({
        stats,
        leagueSlug: r.leagueSlug,
        position: r.position,
        age,
      }),
    })
  }
  return out
}

/**
 * Cached current-season pool for the given leagues. `minGames` keeps cameo
 * appearances out of the market (default 5).
 */
export const getMarketPool = cached(
  (leagueSlugs: string[], minGames = 5) => loadPool(leagueSlugs, minGames),
  "market-pool:v1",
  ["players", "player-season-stats"],
  1800,
)

async function loadMarketPlayer(slug: string): Promise<MarketPlayer | null> {
  const db = getDb()
  const row = await db
    .select({ leagueSlug: leagues.slug })
    .from(players)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .where(and(eq(players.slug, slug), eq(seasons.isCurrent, true)))
    .limit(1)
  const leagueSlug = row[0]?.leagueSlug
  if (!leagueSlug) return null
  // Reuse the league pool (cached) and pick the player out of it — guarantees
  // identical valuation/stat handling as every other market read.
  const pool = await loadPool([leagueSlug], 0)
  return pool.find((p) => p.slug === slug) ?? null
}

/** A single player's current-season market row (stats + valuation). */
export const getMarketPlayerBySlug = cached(
  (slug: string) => loadMarketPlayer(slug),
  "market-player:v1",
  ["players", "player-season-stats"],
  1800,
)

/** Current-season, priced roster of one club — used for release/renewal advice. */
export const getTeamMarketPlayers = cached(
  async (leagueSlug: string, teamId: string): Promise<MarketPlayer[]> => {
    const pool = await loadPool([leagueSlug], 0)
    return pool.filter((p) => p.team?.id === teamId)
  },
  "team-market-players:v1",
  ["players", "player-season-stats"],
  1800,
)
