/**
 * Database side of the scouting numbers: league-season fields for percentiles
 * and multi-season player lines for projections. The maths is in metrics.ts and
 * projection-model.ts; this file only fetches and caches.
 */
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  leagues,
  players,
  playerSeasonStats,
  seasons,
  teams,
  teamSeasonStats,
} from "@/lib/db/schema"
import { cached } from "@/lib/data/cache"
import { latestSeasonName } from "@/lib/data/seasons"
import { canonicalSeasonLabel, seasonNameVariants, seasonStartYear } from "@/lib/seasons"
import {
  metricValues,
  paceFactor,
  percentileProfile,
  qualifies,
  type Basis,
  type PercentileProfile,
  type RawLine,
} from "@/lib/scouting/metrics"
import { leagueStrength } from "@/lib/market/league-strength"
import {
  learnFactors,
  modelFactors,
  type Factors,
  type Transition,
} from "@/lib/scouting/projection-model"

export type FieldRow = {
  playerId: string
  slug: string
  fullName: string
  teamName: string | null
  teamPace: number | null
  line: RawLine
}

const LINE_COLUMNS = {
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
}

function toLine(r: Record<keyof RawLine, number | null>): RawLine {
  return { ...r, gamesPlayed: r.gamesPlayed ?? 0 }
}

async function loadField(leagueSlug: string, seasonName: string): Promise<FieldRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      playerId: players.id,
      slug: players.slug,
      firstName: players.firstName,
      lastName: players.lastName,
      teamName: teams.name,
      teamPace: teamSeasonStats.pace,
      ...LINE_COLUMNS,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .leftJoin(
      teamSeasonStats,
      and(
        eq(teamSeasonStats.teamId, playerSeasonStats.teamId),
        eq(teamSeasonStats.seasonId, playerSeasonStats.seasonId),
        eq(teamSeasonStats.leagueId, playerSeasonStats.leagueId),
      ),
    )
    .where(
      and(
        eq(leagues.slug, leagueSlug),
        inArray(seasons.name, seasonNameVariants(seasonName)),
      ),
    )
  return rows.map((r) => ({
    playerId: r.playerId,
    slug: r.slug,
    fullName: `${r.firstName} ${r.lastName}`.trim(),
    teamName: r.teamName,
    teamPace: r.teamPace,
    line: toLine(r),
  }))
}

export const getLeagueField = cached(
  loadField,
  "scouting-field:v1",
  ["players", "player-stats", "team-stats"],
  3600,
)

export type PlayerPercentiles = {
  leagueSlug: string
  season: string
  basis: Basis
  /** Players in the field who qualified for ranking. */
  qualified: number
  /** False when the player's own line is too small to rank fairly. */
  playerQualifies: boolean
  /** True when no team in the field has a pace, so per40pace == per40. */
  paceMissing: boolean
  profile: PercentileProfile
}

export async function getPlayerPercentiles(
  playerId: string,
  leagueSlug: string,
  season: string | null,
  basis: Basis,
): Promise<PlayerPercentiles | null> {
  const seasonName = season ?? (await latestSeasonName())
  const field = await getLeagueField(leagueSlug, seasonName)
  const me = field.find((f) => f.playerId === playerId)
  if (!me) return null

  const paces = field.map((f) => f.teamPace).filter((p): p is number => p != null && p > 0)
  const leaguePace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null
  const values = (f: FieldRow) =>
    metricValues(f.line, basis, paceFactor(f.teamPace, leaguePace))

  const ranked = field.filter((f) => qualifies(f.line, basis))
  return {
    leagueSlug,
    season: canonicalSeasonLabel(seasonName),
    basis,
    qualified: ranked.length,
    playerQualifies: qualifies(me.line, basis),
    paceMissing: basis === "per40pace" && leaguePace == null,
    profile: percentileProfile(values(me), ranked.map(values)),
  }
}

/* ─── Projection ──────────────────────────────────────────────────────────── */

export type PlayerLine = {
  leagueSlug: string
  leagueName: string
  season: string
  teamName: string | null
  line: RawLine
}

export async function getPlayerLines(slug: string): Promise<{
  id: string
  slug: string
  fullName: string
  position: string | null
  imageUrl: string | null
  lines: PlayerLine[]
} | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      imageUrl: players.imageUrl,
      leagueSlug: leagues.slug,
      leagueName: leagues.name,
      season: seasons.name,
      teamName: teams.name,
      ...LINE_COLUMNS,
    })
    .from(players)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(eq(players.slug, slug))
  if (rows.length === 0) return null
  const first = rows[0]!
  const lines = rows
    .map((r) => ({
      leagueSlug: r.leagueSlug,
      leagueName: r.leagueName,
      season: canonicalSeasonLabel(r.season),
      teamName: r.teamName,
      line: toLine(r),
    }))
    .sort(
      (a, b) =>
        (seasonStartYear(b.season) ?? 0) - (seasonStartYear(a.season) ?? 0) ||
        b.line.gamesPlayed - a.line.gamesPlayed,
    )
  return {
    id: first.id,
    slug: first.slug,
    fullName: `${first.firstName} ${first.lastName}`.trim(),
    position: first.position,
    imageUrl: first.imageUrl,
    lines,
  }
}

export async function loadTransitions(fromSlug: string, toSlug: string): Promise<Transition[]> {
  const db = getDb()
  const rows = await db
    .select({
      playerId: playerSeasonStats.playerId,
      leagueSlug: leagues.slug,
      season: seasons.name,
      ...LINE_COLUMNS,
    })
    .from(playerSeasonStats)
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .where(inArray(leagues.slug, [fromSlug, toSlug]))

  // player → start year → line, one map per side.
  const side = (slug: string) => {
    const m = new Map<string, Map<number, RawLine>>()
    for (const r of rows) {
      if (r.leagueSlug !== slug) continue
      const year = seasonStartYear(r.season)
      if (year == null) continue
      const byYear = m.get(r.playerId) ?? new Map<number, RawLine>()
      byYear.set(year, toLine(r))
      m.set(r.playerId, byYear)
    }
    return m
  }
  const from = side(fromSlug)
  const to = side(toSlug)
  const out: Transition[] = []
  for (const [playerId, fromYears] of from) {
    const toYears = to.get(playerId)
    if (!toYears) continue
    for (const [year, line] of fromYears) {
      const next = toYears.get(year + 1)
      if (next) out.push({ from: line, to: next })
    }
  }
  return out
}

export const getTransitions = cached(
  loadTransitions,
  "scouting-transitions:v1",
  ["players", "player-stats"],
  6 * 3600,
)

export async function getFactors(fromSlug: string, toSlug: string): Promise<Factors> {
  const learned = learnFactors(await getTransitions(fromSlug, toSlug))
  if (learned) return learned
  const to = leagueStrength(toSlug)
  return modelFactors(to > 0 ? leagueStrength(fromSlug) / to : 1)
}
