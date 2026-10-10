/**
 * Current state of a followed player or team, in the shape stored on the
 * follow row. Reads only what the alerts compare, newest season first.
 */
import { and, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { coaches, playerSeasonStats, players, seasons, teams } from "@/lib/db/schema"
import { canonicalSeasonLabel, seasonStartYear } from "@/lib/seasons"
import type { PlayerSnapshot, TeamSnapshot } from "@/lib/alerts/diff"
import { leagues } from "@/lib/db/schema"

const perGame = (total: number | null, games: number) =>
  total == null || games <= 0 ? null : Math.round((total / games) * 10) / 10

export async function playerSnapshot(playerId: string): Promise<PlayerSnapshot | null> {
  const db = getDb()
  const rows = await db
    .select({
      season: seasons.name,
      teamId: playerSeasonStats.teamId,
      teamName: teams.name,
      leagueSlug: leagues.slug,
      gamesPlayed: playerSeasonStats.gamesPlayed,
      pointsTotal: playerSeasonStats.pointsTotal,
      reboundsTotal: playerSeasonStats.reboundsTotal,
      assistsTotal: playerSeasonStats.assistsTotal,
      per: playerSeasonStats.per,
    })
    .from(playerSeasonStats)
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(eq(playerSeasonStats.playerId, playerId))
  if (rows.length === 0) return null
  // Newest season, then the league where he plays the most.
  const r = rows.sort(
    (a, b) =>
      (seasonStartYear(b.season) ?? 0) - (seasonStartYear(a.season) ?? 0) ||
      (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0),
  )[0]!
  const g = r.gamesPlayed ?? 0
  return {
    kind: "player",
    teamId: r.teamId,
    teamName: r.teamName,
    leagueSlug: r.leagueSlug,
    season: canonicalSeasonLabel(r.season),
    gamesPlayed: g,
    ppg: perGame(r.pointsTotal, g),
    rpg: perGame(r.reboundsTotal, g),
    apg: perGame(r.assistsTotal, g),
    per: r.per,
  }
}

export async function teamSnapshot(teamId: string): Promise<TeamSnapshot | null> {
  const db = getDb()
  const rows = await db
    .select({ season: seasons.name, playerId: playerSeasonStats.playerId })
    .from(playerSeasonStats)
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .where(eq(playerSeasonStats.teamId, teamId))
  if (rows.length === 0) return null
  const newest = Math.max(...rows.map((r) => seasonStartYear(r.season) ?? 0))
  const current = rows.filter((r) => (seasonStartYear(r.season) ?? 0) === newest)
  const seasonName = current[0]?.season ?? null

  const head = seasonName
    ? await db
        .select({ name: coaches.fullName })
        .from(coaches)
        .innerJoin(seasons, eq(coaches.seasonId, seasons.id))
        .where(
          and(
            eq(coaches.teamId, teamId),
            eq(coaches.role, "head_coach"),
            inArray(seasons.name, [seasonName]),
          ),
        )
        .orderBy(desc(coaches.updatedAt))
        .limit(1)
    : []

  return {
    kind: "team",
    season: seasonName ? canonicalSeasonLabel(seasonName) : null,
    playerIds: [...new Set(current.map((r) => r.playerId))].sort(),
    headCoach: head[0]?.name ?? null,
  }
}

export async function playerNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await getDb()
    .select({ id: players.id, first: players.firstName, last: players.lastName })
    .from(players)
    .where(inArray(players.id, ids))
  return new Map(rows.map((r) => [r.id, `${r.first} ${r.last}`.trim()]))
}
