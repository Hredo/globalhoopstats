import { and, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm"
import pLimit from "p-limit"
import { getDb } from "@/lib/db/client"
import {
  coaches,
  leagues,
  playerSeasonStats,
  players,
  seasons,
  teams,
} from "@/lib/db/schema"
import { resolveLeagueName } from "@/lib/sources/types"
import { cached } from "@/lib/data/cache"
import { canonicalSeasonLabel, compareSeasonsDesc } from "@/lib/seasons"

export type LeagueTeamLogo = {
  name: string
  slug: string
  logoUrl: string | null
}

export type LeagueScorer = {
  playerId: string
  fullName: string
  slug: string
  imageUrl: string | null
  team: { id: string; name: string; slug: string; logoUrl: string | null } | null
  ppg: number
}

export type LeagueStatHighlight = {
  playerId: string
  fullName: string
  slug: string
  imageUrl: string | null
  value: number
  teamName: string | null
  teamLogo: string | null
}

export type LeagueOverview = {
  id: string
  slug: string
  name: string
  region: string
  logoUrl: string | null
  seasonLabel: string | null
  teamCount: number
  playerCount: number
  coachCount: number
  topScorers: LeagueScorer[]
  teams: LeagueTeamLogo[]
  topAssists: LeagueStatHighlight | null
  topRebounds: LeagueStatHighlight | null
  topThreePtPct: LeagueStatHighlight | null
}

export type GlobalLeagueCounts = {
  leagues: number
  players: number
  teams: number
  coaches: number
}

type LeagueRow = {
  id: string
  slug: string
  name: string
  region: string
  logoUrl: string | null
}

function formatSeasonLabel(name: string | null): string | null {
  if (!name) return null
  // A legacy EuroLeague row is stored as "E2025"; the league card must still
  // read "2025-26" like every other competition.
  return canonicalSeasonLabel(name)
}

async function fetchLatestSeason(
  db: ReturnType<typeof getDb>,
  leagueId: string,
): Promise<{ id: string; name: string } | null> {
  // Seasons can be duplicated by name (same label, different ids); prefer the
  // row holding the most stats for this league so partial duplicates lose.
  const rows = await db
    .select({
      id: seasons.id,
      name: seasons.name,
      statRows: sql<number>`count(*)`,
    })
    .from(seasons)
    .innerJoin(
      playerSeasonStats,
      and(
        eq(playerSeasonStats.seasonId, seasons.id),
        eq(playerSeasonStats.leagueId, leagueId),
      ),
    )
    .groupBy(seasons.id, seasons.name)
  // Sorted here rather than in SQL: `ORDER BY name DESC` puts the legacy
  // "E2025" ahead of "2026-27" (the letter beats the digit), which would pin
  // the EuroLeague card to a season two years stale.
  const sorted = [...rows].sort(
    (a, b) =>
      compareSeasonsDesc(a.name, b.name) ||
      Number(b.statRows ?? 0) - Number(a.statRows ?? 0),
  )
  return sorted[0] ? { id: sorted[0].id, name: sorted[0].name } : null
}

async function fetchCounts(
  db: ReturnType<typeof getDb>,
  leagueId: string,
  seasonId: string | null,
): Promise<{ teamCount: number; playerCount: number; coachCount: number }> {
  // Scoped to the season on the card. Counting every season turned a league
  // into the sum of its history — 40+ "teams" for an 18-club competition.
  const seasonScope = seasonId
    ? eq(playerSeasonStats.seasonId, seasonId)
    : undefined
  const [t] = await db
    .select({ c: sql<number>`count(distinct ${playerSeasonStats.teamId})` })
    .from(playerSeasonStats)
    .where(and(eq(playerSeasonStats.leagueId, leagueId), seasonScope))
  const [p] = await db
    .select({ c: sql<number>`count(distinct ${playerSeasonStats.playerId})` })
    .from(playerSeasonStats)
    .where(and(eq(playerSeasonStats.leagueId, leagueId), seasonScope))
  const [c] = await db
    .select({ c: sql<number>`count(*)` })
    .from(coaches)
    .where(
      and(
        eq(coaches.leagueId, leagueId),
        // Null season = row written before coaches were season-scoped; counting
        // it keeps the card honest until the rollover backfill runs.
        seasonId
          ? or(eq(coaches.seasonId, seasonId), isNull(coaches.seasonId))
          : undefined,
      ),
    )
  return {
    teamCount: Number(t?.c ?? 0),
    playerCount: Number(p?.c ?? 0),
    coachCount: Number(c?.c ?? 0),
  }
}

async function fetchTopScorers(
  db: ReturnType<typeof getDb>,
  leagueId: string,
  seasonId: string,
  limit = 3,
): Promise<LeagueScorer[]> {
  const rows = await db
    .select({
      playerId: players.id,
      fullName: sql<string>`concat(${players.firstName}, ' ', ${players.lastName})`,
      slug: players.slug,
      imageUrl: players.imageUrl,
      ppg: sql<number>`round(${playerSeasonStats.pointsTotal} / nullif(${playerSeasonStats.gamesPlayed}, 0), 1)`,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamLogo: teams.logoUrl,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(
      and(
        eq(playerSeasonStats.leagueId, leagueId),
        eq(playerSeasonStats.seasonId, seasonId),
        isNotNull(playerSeasonStats.pointsTotal),
        sql`${playerSeasonStats.gamesPlayed} >= 5`,
      ),
    )
    .orderBy(
      sql`${playerSeasonStats.pointsTotal} / nullif(${playerSeasonStats.gamesPlayed}, 0) desc`,
    )
    .limit(limit * 4)
  // A player can carry duplicate rows in one season (duplicated team entities
  // from sync); keep only their best line.
  const seen = new Set<string>()
  const deduped: typeof rows = []
  for (const r of rows) {
    if (seen.has(r.playerId)) continue
    seen.add(r.playerId)
    deduped.push(r)
    if (deduped.length === limit) break
  }
  return deduped.map((r) => ({
    playerId: r.playerId,
    fullName: r.fullName,
    slug: r.slug,
    imageUrl: r.imageUrl,
    ppg: Number(r.ppg ?? 0),
    team: r.teamId
      ? { id: r.teamId, name: r.teamName ?? "", slug: r.teamSlug ?? "", logoUrl: r.teamLogo }
      : null,
  }))
}

async function fetchTeamLogos(
  db: ReturnType<typeof getDb>,
  leagueId: string,
  seasonId: string | null,
): Promise<LeagueTeamLogo[]> {
  const rows = await db
    .select({
      name: teams.name,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
    })
    .from(teams)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.teamId, teams.id))
    .where(
      and(
        eq(playerSeasonStats.leagueId, leagueId),
        // The badge strip is this season's field, not a club museum.
        seasonId ? eq(playerSeasonStats.seasonId, seasonId) : undefined,
      ),
    )
    .groupBy(teams.id, teams.name, teams.slug, teams.logoUrl)
    .orderBy(teams.name)
  return rows
}

async function fetchTopPlayer(
  db: ReturnType<typeof getDb>,
  leagueId: string,
  seasonId: string,
  column: SQL,
  isTotal: boolean,
): Promise<LeagueStatHighlight | null> {
  const valueExpr = isTotal
    ? sql<number>`round(${column} / nullif(${playerSeasonStats.gamesPlayed}, 0), 1)`
    : sql<number>`round(${column}, 1)`

  const orderExpr = isTotal
    ? sql`${column} / nullif(${playerSeasonStats.gamesPlayed}, 0) desc`
    : sql`${column} desc`

  const rows = await db
    .select({
      playerId: players.id,
      fullName: sql<string>`concat(${players.firstName}, ' ', ${players.lastName})`,
      slug: players.slug,
      imageUrl: players.imageUrl,
      value: valueExpr,
      teamName: teams.name,
      teamLogo: teams.logoUrl,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(
      and(
        eq(playerSeasonStats.leagueId, leagueId),
        eq(playerSeasonStats.seasonId, seasonId),
        sql`${column} is not null`,
        sql`${playerSeasonStats.gamesPlayed} >= 5`,
      ),
    )
    .orderBy(orderExpr)
    .limit(4)

  const seen = new Set<string>()
  for (const r of rows) {
    if (seen.has(r.playerId)) continue
    seen.add(r.playerId)
    return {
      playerId: r.playerId,
      fullName: r.fullName,
      slug: r.slug,
      imageUrl: r.imageUrl,
      value: Number(r.value ?? 0),
      teamName: r.teamName,
      teamLogo: r.teamLogo,
    }
  }
  return null
}

export const listLeagueOverviews = cached(
  async (): Promise<LeagueOverview[]> => {
  const db = getDb()
  const baseRows = await db
    .select({
      id: leagues.id,
      slug: leagues.slug,
      name: leagues.name,
      region: leagues.region,
      logoUrl: leagues.logoUrl,
    })
    .from(leagues)
    .orderBy(ascLabel(leagues.name))

  const limit = pLimit(3)
  const overviews = await Promise.all(
    baseRows.map((row) =>
      limit(async (): Promise<LeagueOverview> => {
        // The season has to be resolved first: counts and badges are scoped
        // to it, so they cannot be fetched in the same parallel batch.
        const season = await fetchLatestSeason(db, row.id)
        const [counts, teamLogos] = await Promise.all([
          fetchCounts(db, row.id, season?.id ?? null),
          fetchTeamLogos(db, row.id, season?.id ?? null),
        ])
        const [topScorers, topAssists, topRebounds, topThreePtPct] = season
          ? await Promise.all([
              fetchTopScorers(db, row.id, season.id, 3),
              fetchTopPlayer(db, row.id, season.id, sql`${playerSeasonStats.assistsTotal}`, true),
              fetchTopPlayer(db, row.id, season.id, sql`${playerSeasonStats.reboundsTotal}`, true),
              fetchTopPlayer(db, row.id, season.id, sql`coalesce(${playerSeasonStats.threeMade}, 0) / nullif(${playerSeasonStats.threeAttempted}, 0) * 100`, false),
            ])
          : [[], null, null, null] as [LeagueScorer[], LeagueStatHighlight | null, LeagueStatHighlight | null, LeagueStatHighlight | null]
        return {
          id: row.id,
          slug: row.slug,
          name: resolveLeagueName(row.slug, row.name),
          region: row.region,
          logoUrl: row.logoUrl,
          seasonLabel: formatSeasonLabel(season?.name ?? null),
          teamCount: counts.teamCount,
          playerCount: counts.playerCount,
          coachCount: counts.coachCount,
          topScorers,
          teams: teamLogos,
          topAssists,
          topRebounds,
          topThreePtPct,
        }
      }),
    ),
  )
  return overviews
  },
  // v2: counts, badges and the season label are scoped to the newest season.
  "listLeagueOverviews:v2",
  ["leagues", "seasons", "player-season-stats", "teams", "coaches"],
  600,
)

/**
 * A league's scoring leaders (points per game, 5+ games) in its newest season,
 * for the leaders table on /leagues/[slug]. Same query as the overview card's
 * top three, just longer.
 */
export const listLeagueTopScorers = cached(
  async (leagueId: string, limit: number): Promise<LeagueScorer[]> => {
    const db = getDb()
    const season = await fetchLatestSeason(db, leagueId)
    if (!season) return []
    return fetchTopScorers(db, leagueId, season.id, limit)
  },
  "listLeagueTopScorers:v1",
  ["leagues", "seasons", "player-season-stats", "teams"],
  600,
)

function ascLabel(column: typeof leagues.name) {
  return sql`lower(${column}) asc`
}

export const getGlobalLeagueCounts = cached(
  async (): Promise<GlobalLeagueCounts> => {
    try {
      const db = getDb()
      const [l] = await db.select({ c: sql<number>`count(*)` }).from(leagues)
      const [p] = await db.select({ c: sql<number>`count(*)` }).from(players)
      const [t] = await db.select({ c: sql<number>`count(*)` }).from(teams)
      const [c] = await db.select({ c: sql<number>`count(*)` }).from(coaches)
      return {
        leagues: Number(l?.c ?? 0),
        players: Number(p?.c ?? 0),
        teams: Number(t?.c ?? 0),
        coaches: Number(c?.c ?? 0),
      }
    } catch (error) {
      console.warn("[getGlobalLeagueCounts] falling back to zero counts", error)
      return {
        leagues: 0,
        players: 0,
        teams: 0,
        coaches: 0,
      }
    }
  },
  "getGlobalLeagueCounts",
  ["players", "teams", "coaches"],
  600,
)
