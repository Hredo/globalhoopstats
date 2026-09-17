import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import {
  leagues,
  playerSeasonStats,
  players,
  seasons,
  teams,
} from "@/lib/db/schema"
import { resolveLeagueName } from "@/lib/sources/types"
import { cached } from "@/lib/data/cache"
import { latestSeasonName } from "@/lib/data/seasons"
import {
  canonicalSeasonLabel,
  compareSeasonsDesc,
  seasonNameVariants,
} from "@/lib/seasons"

export type CompareStats = {
  seasonId: string
  seasonName: string
  gamesPlayed: number
  pointsTotal: number | null
  reboundsTotal: number | null
  offensiveRebounds: number | null
  defensiveRebounds: number | null
  assistsTotal: number | null
  stealsTotal: number | null
  blocksTotal: number | null
  fgPct: number | null
  threePct: number | null
  ftPct: number | null
  fgMade: number | null
  fgAttempted: number | null
  threeMade: number | null
  threeAttempted: number | null
  ftMade: number | null
  ftAttempted: number | null
  minutesTotal: number | null
  foulsTotal: number | null
  plusMinus: number | null
  per: number | null
}

export type ComparePlayer = {
  id: string
  slug: string
  fullName: string
  imageUrl: string | null
  position: string | null
  nationality: string | null
  team: { id: string; name: string; slug: string; logoUrl: string | null } | null
  league: { id: string; name: string; slug: string; region: string }
  stats: CompareStats | null
  /** Season the `stats` line above belongs to, null when there is none. */
  season: string | null
  /** Every season this player has a line for, newest first, across leagues. */
  availableSeasons: string[]
  /** League the fallback season was played in — may differ after a transfer. */
  fallbackLeague: string | null
  /**
   * Best prior season, when the selected one is too thin to compare on.
   *
   * A player two games into a new campaign has numbers, but not numbers worth
   * ranking anybody by — the comparison UI and the AI brief both need a
   * previous season to lean on and must say which one they used.
   */
  fallbackStats: CompareStats | null
  fallbackSeason: string | null
}

export const getPlayerForCompare = cached(
  async (slug: string, season?: string): Promise<ComparePlayer | null> => {
  const db = getDb()
  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      // Every other query in the app builds the name this way. This one
      // selected `firstName` alone, so the whole compare screen — headers,
      // stat rows, verdict and the AI brief — called each player by their
      // first name only. Two players called Aaron came out as "Aaron vs
      // Aaron", and the model quite reasonably asked which Aaron we meant.
      fullName: sql<string>`concat(${players.firstName}, ' ', ${players.lastName})`,
      imageUrl: players.imageUrl,
      position: players.position,
      nationality: players.nationality,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamLogo: teams.logoUrl,
      leagueId: leagues.id,
      leagueName: leagues.name,
      leagueSlug: leagues.slug,
      leagueRegion: leagues.region,
    })
    .from(players)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    // League and club are read from the REQUESTED season, otherwise a player
    // who changed club in the summer keeps showing last season's badge.
    .where(
      season
        ? and(
            eq(players.slug, slug),
            inArray(seasons.name, seasonNameVariants(season)),
          )
        : eq(players.slug, slug),
    )
    .orderBy(desc(seasons.name), desc(playerSeasonStats.gamesPlayed))
    .limit(1)

  const r = rows[0]
  if (!r) {
    // Requested a season this player did not play: fall back to their record
    // rather than rendering an empty card the visitor cannot explain.
    return season ? getPlayerForCompare(slug) : null
  }

  // Every season, not just the newest: the caller picks one and the AI brief
  // needs a prior season to reach for when the selected one is barely started.
  const allStatRows = await db
    .select({
      seasonId: seasons.id,
      seasonName: seasons.name,
      gamesPlayed: playerSeasonStats.gamesPlayed,
      pointsTotal: playerSeasonStats.pointsTotal,
      reboundsTotal: playerSeasonStats.reboundsTotal,
      offensiveRebounds: playerSeasonStats.offensiveRebounds,
      defensiveRebounds: playerSeasonStats.defensiveRebounds,
      assistsTotal: playerSeasonStats.assistsTotal,
      stealsTotal: playerSeasonStats.stealsTotal,
      blocksTotal: playerSeasonStats.blocksTotal,
      fgMade: playerSeasonStats.fgMade,
      fgAttempted: playerSeasonStats.fgAttempted,
      threeMade: playerSeasonStats.threeMade,
      threeAttempted: playerSeasonStats.threeAttempted,
      ftMade: playerSeasonStats.ftMade,
      ftAttempted: playerSeasonStats.ftAttempted,
      minutesTotal: playerSeasonStats.minutesTotal,
      foulsTotal: playerSeasonStats.foulsTotal,
      plusMinus: playerSeasonStats.plusMinus,
      per: playerSeasonStats.per,
      leagueId: leagues.id,
      leagueName: leagues.name,
      leagueSlug: leagues.slug,
    })
    .from(playerSeasonStats)
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    // EVERY league, not just the one they are in now. A career crosses
    // competitions — ACB one season, EuroLeague the next — and scoping this to
    // the current league meant a player who had just transferred looked like a
    // rookie with no history to fall back on.
    .where(eq(playerSeasonStats.playerId, r.id))
    .orderBy(desc(seasons.name))

  const lines = allStatRows
    .map((row) => ({
      ...row,
      seasonName: canonicalSeasonLabel(row.seasonName),
      fgPct: pct(row.fgMade, row.fgAttempted),
      threePct: pct(row.threeMade, row.threeAttempted),
      ftPct: pct(row.ftMade, row.ftAttempted),
    }))
    .sort((x, y) => compareSeasonsDesc(x.seasonName, y.seasonName))

  const availableSeasons = [...new Set(lines.map((l) => l.seasonName))]
  const wanted = season ? canonicalSeasonLabel(season) : availableSeasons[0]
  // Within a season a player can hold rows in two leagues at once (a EuroLeague
  // club also plays its domestic league); prefer the league the identity row
  // resolved to, then whichever line has the most games.
  const forSeason = lines.filter((l) => l.seasonName === wanted)
  const selected =
    forSeason.find((l) => l.leagueId === r.leagueId) ??
    forSeason.sort((x, y) => (y.gamesPlayed ?? 0) - (x.gamesPlayed ?? 0))[0] ??
    lines[0] ??
    null
  // The richest earlier season, so a thin current line has something to lean on.
  const fallback = selected
    ? (lines
        .filter(
          (l) =>
            l.seasonName !== selected.seasonName &&
            compareSeasonsDesc(l.seasonName, selected.seasonName) > 0,
        )
        .sort((x, y) => (y.gamesPlayed ?? 0) - (x.gamesPlayed ?? 0))[0] ?? null)
    : null

  return {
    id: r.id,
    slug: r.slug,
    fullName: r.fullName,
    // PHOTOS PAUSED (2026-07-03): force null so stale cache can't serve
    // old image_url values; re-enable with `imageUrl: r.imageUrl` when
    // the photo pipeline is un-paused.
    imageUrl: null,
    position: r.position,
    nationality: r.nationality,
    league: {
      id: r.leagueId,
      name: resolveLeagueName(r.leagueSlug, r.leagueName),
      slug: r.leagueSlug,
      region: r.leagueRegion,
    },
    team:
      r.teamId && r.teamName && r.teamSlug
        ? { id: r.teamId, name: r.teamName, slug: r.teamSlug, logoUrl: r.teamLogo }
        : null,
    stats: selected,
    season: selected?.seasonName ?? null,
    availableSeasons,
    fallbackStats: fallback,
    fallbackSeason: fallback?.seasonName ?? null,
    fallbackLeague: fallback
      ? resolveLeagueName(fallback.leagueSlug, fallback.leagueName)
      : null,
  }
  },
  // v3: the fallback season may come from a different league (transfers).
  "getPlayerForCompare:v3",
  ["players", "player-season-stats"],
  3600,
)

function pct(made: number | null, attempted: number | null): number | null {
  if (made == null || attempted == null || attempted <= 0) return null
  return made / attempted
}

/**
 * Compare view of a player for a given season.
 *
 * `season` is resolved to the newest one with data when omitted, so the compare
 * screen always opens on the current campaign.
 */
export async function getComparePlayer(
  slug: string,
  season?: string,
): Promise<ComparePlayer | null> {
  const wanted = season ?? (await latestSeasonName())
  return getPlayerForCompare(slug, wanted)
}
