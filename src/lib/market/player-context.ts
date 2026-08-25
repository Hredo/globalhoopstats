/**
 * Where a player sits inside his own league.
 *
 * A scouting note that says "26.6 points a game" tells a coach nothing unless
 * he already knows what a lot is in that league. The same number is a superstar
 * in Tercera FEB and a good starter in the NBA. So we measure the league and
 * hand the model the comparison — average, rank, percentile — instead of
 * hoping it remembers.
 *
 * Everything here is counted from the same priced pool the market pages use.
 */
import { getMarketPool, type MarketPlayer } from "@/lib/market/pool"
import { leagueEconomics } from "@/lib/market/league-strength"
import type { Locale } from "@/lib/i18n/config"

/** Games below which a season is a cameo, not a sample. */
const MIN_GAMES = 5
/** Three-point attempts below which a percentage is an accident. */
const MIN_THREE_ATTEMPTS = 40

export type StatRank = {
  /** Stable key; the caller supplies the wording. */
  key: "points" | "rebounds" | "assists" | "threePct" | "rating"
  value: number
  leagueAvg: number
  /** Share of qualified players he is better than, 0-100. */
  percentile: number
  rank: number
  qualified: number
}

export type PlayerLeagueContext = {
  leagueSlug: string
  leagueLabel: string
  qualified: number
  ranks: StatRank[]
}

function perGame(total: number | null | undefined, games: number): number | null {
  return total == null || games <= 0 ? null : total / games
}

function summarise(
  key: StatRank["key"],
  mine: number,
  others: number[],
): StatRank | null {
  if (others.length < 5) return null
  const avg = others.reduce((a, b) => a + b, 0) / others.length
  const better = others.filter((v) => v < mine).length
  return {
    key,
    value: mine,
    leagueAvg: avg,
    percentile: Math.round((better / others.length) * 100),
    rank: others.filter((v) => v > mine).length + 1,
    qualified: others.length,
  }
}

/**
 * Null when the player has no current-season sample, or the league has too few
 * measured players to compare against (which is the honest answer for a tier
 * we have barely scraped).
 */
export async function playerLeagueContext(
  player: MarketPlayer,
): Promise<PlayerLeagueContext | null> {
  const games = player.stats.gamesPlayed
  if (games < MIN_GAMES) return null

  const pool = (await getMarketPool([player.league.slug], MIN_GAMES)).filter(
    (p) => p.stats.gamesPlayed >= MIN_GAMES,
  )
  if (pool.length < 10) return null

  const ranks: StatRank[] = []

  const counting: Array<[StatRank["key"], (p: MarketPlayer) => number | null]> =
    [
      ["points", (p) => perGame(p.stats.pointsTotal, p.stats.gamesPlayed)],
      ["rebounds", (p) => perGame(p.stats.reboundsTotal, p.stats.gamesPlayed)],
      ["assists", (p) => perGame(p.stats.assistsTotal, p.stats.gamesPlayed)],
    ]
  for (const [key, read] of counting) {
    const mine = read(player)
    if (mine == null) continue
    const others = pool
      .map(read)
      .filter((v): v is number => v != null)
    const rank = summarise(key, mine, others)
    if (rank) ranks.push(rank)
  }

  // Shooting is only comparable among players who actually shoot.
  const shoots = (p: MarketPlayer): boolean =>
    (p.stats.threeAttempted ?? 0) >= MIN_THREE_ATTEMPTS
  if (player.stats.threePct != null && shoots(player)) {
    const others = pool
      .filter(shoots)
      .map((p) => p.stats.threePct)
      .filter((v): v is number => v != null)
    const rank = summarise("threePct", player.stats.threePct, others)
    if (rank) ranks.push(rank)
  }

  const ratings = pool.map((p) => p.valuation.rating)
  const ratingRank = summarise("rating", player.valuation.rating, ratings)
  if (ratingRank) ranks.push(ratingRank)

  if (ranks.length === 0) return null
  return {
    leagueSlug: player.league.slug,
    leagueLabel: leagueEconomics(player.league.slug).label,
    qualified: pool.length,
    ranks,
  }
}

const LABELS: Record<Locale, Record<StatRank["key"], string>> = {
  en: {
    points: "Points a game",
    rebounds: "Rebounds a game",
    assists: "Assists a game",
    threePct: "Three-point shooting",
    rating: "Our impact rating (0-100, our own estimate)",
  },
  es: {
    points: "Puntos por partido",
    rebounds: "Rebotes por partido",
    assists: "Asistencias por partido",
    threePct: "Acierto en triples",
    rating: "Nuestro rating de impacto (0-100, estimación propia)",
  },
}

function fmtValue(key: StatRank["key"], value: number): string {
  if (key === "threePct") return `${(value * 100).toFixed(1)}%`
  if (key === "rating") return value.toFixed(0)
  return value.toFixed(1)
}

/**
 * The context as a prompt block, with an explicit instruction to USE it — a
 * model handed a table of numbers will otherwise recite the player's own line
 * and ignore the comparison that makes it mean something.
 */
export function describeLeagueContext(
  ctx: PlayerLeagueContext | null,
  locale: Locale,
): string {
  if (!ctx) return ""
  const es = locale === "es"
  const labels = LABELS[locale] ?? LABELS.en

  const header = es
    ? `COMPARACIÓN CON EL RESTO DE ${ctx.leagueLabel} (${ctx.qualified} jugadores medidos esta temporada) —`
    : `HOW HE COMPARES IN ${ctx.leagueLabel} (${ctx.qualified} measured players this season) —`

  const lines = ctx.ranks.map((r) => {
    const value = fmtValue(r.key, r.value)
    const avg = fmtValue(r.key, r.leagueAvg)
    return es
      ? `- ${labels[r.key]}: ${value} — media de la liga ${avg}; mejor que el ${r.percentile}% (puesto ${r.rank} de ${r.qualified})`
      : `- ${labels[r.key]}: ${value} — league average ${avg}; better than ${r.percentile}% (ranked ${r.rank} of ${r.qualified})`
  })

  const rule = es
    ? "Apóyate en estas comparaciones al valorar: di si un número es alto o bajo PARA SU LIGA y con qué lo comparas. No repitas la lista entera ni cites más de tres."
    : "Lean on these comparisons when you judge him: say whether a number is high or low FOR HIS LEAGUE and against what. Do not recite the whole list, and never cite more than three."

  return [header, ...lines, "", rule].join("\n")
}
