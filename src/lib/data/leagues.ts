import { and, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm"
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
import { cached } from "@/lib/data/cache"

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
  return name
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
    .orderBy(desc(seasons.name), sql`count(*) desc`)
    .limit(1)
  return rows[0] ? { id: rows[0].id, name: rows[0].name } : null
}

async function fetchCounts(
  db: ReturnType<typeof getDb>,
  leagueId: string,
): Promise<{ teamCount: number; playerCount: number; coachCount: number }> {
  const [t] = await db
    .select({ c: sql<number>`count(distinct team_id)` })
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.leagueId, leagueId))
  const [p] = await db
    .select({ c: sql<number>`count(distinct player_id)` })
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.leagueId, leagueId))
  const [c] = await db
    .select({ c: sql<number>`count(*)` })
    .from(coaches)
    .where(eq(coaches.leagueId, leagueId))
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
      fullName: sql<string>`${players.firstName} || ' ' || ${players.lastName}`,
      slug: players.slug,
      imageUrl: players.imageUrl,
      ppg: sql<number>`round(${playerSeasonStats.pointsTotal}::numeric / nullif(${playerSeasonStats.gamesPlayed}, 0), 1)`,
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
      sql`${playerSeasonStats.pointsTotal}::numeric / nullif(${playerSeasonStats.gamesPlayed}, 0) desc nulls last`,
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
): Promise<LeagueTeamLogo[]> {
  const rows = await db
    .select({
      name: teams.name,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
    })
    .from(teams)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.teamId, teams.id))
    .where(eq(playerSeasonStats.leagueId, leagueId))
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
    : sql<number>`round(${column}::numeric, 1)`

  const orderExpr = isTotal
    ? sql`${column} / nullif(${playerSeasonStats.gamesPlayed}, 0) desc nulls last`
    : sql`${column} desc nulls last`

  const rows = await db
    .select({
      playerId: players.id,
      fullName: sql<string>`${players.firstName} || ' ' || ${players.lastName}`,
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
        const [counts, season, teamLogos] = await Promise.all([
          fetchCounts(db, row.id),
          fetchLatestSeason(db, row.id),
          fetchTeamLogos(db, row.id),
        ])
        const [topScorers, topAssists, topRebounds, topThreePtPct] = season
          ? await Promise.all([
              fetchTopScorers(db, row.id, season.id, 3),
              fetchTopPlayer(db, row.id, season.id, sql`${playerSeasonStats.assistsTotal}`, true),
              fetchTopPlayer(db, row.id, season.id, sql`${playerSeasonStats.reboundsTotal}`, true),
              fetchTopPlayer(db, row.id, season.id, sql`coalesce(${playerSeasonStats.threeMade}, 0)::numeric / nullif(${playerSeasonStats.threeAttempted}, 0) * 100`, false),
            ])
          : [[], null, null, null] as [LeagueScorer[], LeagueStatHighlight | null, LeagueStatHighlight | null, LeagueStatHighlight | null]
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
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
  "listLeagueOverviews",
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
