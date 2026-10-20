import type { PlayerCareerLine } from "@/lib/data/players"
import { LEAGUE_ECONOMICS } from "@/lib/market/league-strength"
import { compareSeasonsDesc } from "@/lib/seasons"

/**
 * A player's career as a ladder: which league he played in each season, and
 * the runs of consecutive seasons spent with one club in one league.
 *
 * Built from `PlayerProfile.allSeasons`, so it costs no query. A season can
 * hold several lines (a mid-season transfer, or a club that plays both the
 * EuroLeague and the ACB); the strongest league that season is the one the
 * career path runs through, the others are drawn beside it.
 */

export type CareerMove = "up" | "down" | "transfer"

export type CareerStint = {
  league: { name: string; slug: string }
  team: { name: string; slug: string } | null
  /** First and last season of the run (canonical labels). */
  from: string
  to: string
  seasons: number
  games: number
  /** Points per game over the whole run; null when no line had points. */
  ppg: number | null
  /** How the player got here, compared with the season before; null at the start or when nothing changed. */
  move: CareerMove | null
}

export type CareerPoint = {
  season: string
  /** Column: index into `seasons`. */
  x: number
  /** Row: index into `leagues`. */
  y: number
  /** True for the line the career path runs through that season. */
  main: boolean
  games: number
}

export type CareerTimeline = {
  /** Oldest first. */
  seasons: string[]
  /** Leagues of the career, strongest first (top row of the ladder). */
  leagues: { name: string; slug: string }[]
  points: CareerPoint[]
  /** Oldest first. */
  stints: CareerStint[]
}

function strength(slug: string): number {
  return LEAGUE_ECONOMICS[slug]?.strength ?? 0
}

function teamKey(line: {
  league: { slug: string }
  team: { slug: string } | null
}): string {
  return `${line.league.slug}::${line.team?.slug ?? ""}`
}

function byStrength(a: PlayerCareerLine, b: PlayerCareerLine): number {
  return (
    strength(b.league.slug) - strength(a.league.slug) ||
    b.gamesPlayed - a.gamesPlayed
  )
}

export function buildCareerTimeline(
  career: readonly PlayerCareerLine[],
): CareerTimeline {
  const lines = career.filter((l) => l.gamesPlayed > 0)
  const seasons = [...new Set(lines.map((l) => l.seasonName))].sort((a, b) =>
    compareSeasonsDesc(b, a),
  )
  const bySeason = new Map<string, PlayerCareerLine[]>()
  for (const l of lines) {
    const list = bySeason.get(l.seasonName) ?? []
    list.push(l)
    bySeason.set(l.seasonName, list)
  }

  const leagueMap = new Map<string, { name: string; slug: string }>()
  for (const l of lines) leagueMap.set(l.league.slug, l.league)
  const leagues = [...leagueMap.values()].sort(
    (a, b) =>
      strength(b.slug) - strength(a.slug) || a.name.localeCompare(b.name),
  )
  const row = new Map(leagues.map((l, i) => [l.slug, i]))

  type Open = CareerStint & {
    key: string
    lastX: number
    pointSum: number
    pointGames: number
  }
  const points: CareerPoint[] = []
  const stints: Open[] = []
  let prevMain: PlayerCareerLine | null = null

  seasons.forEach((season, x) => {
    // Stronger lines first: the first one is the season's main line, and
    // parallel stints keep a stable order.
    const here = [...(bySeason.get(season) ?? [])].sort(byStrength)
    const main = here[0]
    const seen = new Set<string>()
    for (const line of here) {
      const key = teamKey(line)
      if (seen.has(key)) continue
      seen.add(key)
      points.push({
        season,
        x,
        y: row.get(line.league.slug) ?? 0,
        main: line === main,
        games: line.gamesPlayed,
      })

      const open = stints.find((s) => s.key === key && s.lastX === x - 1)
      if (open) {
        open.to = season
        open.lastX = x
        open.seasons += 1
        open.games += line.gamesPlayed
        if (line.pointsTotal != null) {
          open.pointSum += line.pointsTotal
          open.pointGames += line.gamesPlayed
        }
        continue
      }

      let move: CareerMove | null = null
      if (prevMain) {
        const diff = strength(line.league.slug) - strength(prevMain.league.slug)
        if (diff > 0) move = "up"
        else if (diff < 0) move = "down"
        else if (teamKey(prevMain) !== key) move = "transfer"
      }
      stints.push({
        key,
        lastX: x,
        league: line.league,
        team: line.team,
        from: season,
        to: season,
        seasons: 1,
        games: line.gamesPlayed,
        pointSum: line.pointsTotal ?? 0,
        pointGames: line.pointsTotal != null ? line.gamesPlayed : 0,
        ppg: null,
        move,
      })
    }
    prevMain = main
  })

  return {
    seasons,
    leagues,
    points,
    stints: stints.map((s) => ({
      league: s.league,
      team: s.team,
      from: s.from,
      to: s.to,
      seasons: s.seasons,
      games: s.games,
      ppg: s.pointGames > 0 ? s.pointSum / s.pointGames : null,
      move: s.move,
    })),
  }
}
