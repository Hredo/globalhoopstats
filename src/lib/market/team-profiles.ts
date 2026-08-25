/**
 * Measured profiles of every club in a league, built from the same priced pool
 * the rest of the market features read.
 *
 * Why this exists: a coach asking "which ACB team could run this play?" was
 * getting an answer out of the model's memory — vague when it was not wrong.
 * A model cannot know who can shoot this season; we can, so we hand it the
 * numbers and tell it to choose from them.
 *
 * Every field here is counted from real season stats. Nothing is estimated,
 * which is why there is no team three-point percentage: the pool keeps
 * per-player percentages, not the makes and attempts you would need to add up.
 * Counting the shooters is honest; averaging percentages is not.
 */
import { getMarketPool, type MarketPlayer } from "@/lib/market/pool"
import { leagueEconomics } from "@/lib/market/league-strength"
import type { Locale } from "@/lib/i18n/config"

/** A shooter, for our purposes: makes better than a third of his threes. */
const SHOOTER_THREE_PCT = 0.35
/** A big, for our purposes. Roughly 6'9". */
const BIG_HEIGHT_CM = 205
/** Below this, a percentage is noise rather than a skill. */
const MIN_GAMES = 5

export type TeamProfile = {
  name: string
  players: number
  avgHeightCm: number | null
  avgAge: number | null
  shooters: number
  bestShooter: { name: string; threePct: number } | null
  bigs: number
  topScorer: { name: string; ppg: number } | null
  topRebounder: { name: string; rpg: number } | null
  topPasser: { name: string; apg: number } | null
}

function perGame(total: number | null, games: number): number {
  return total == null || games <= 0 ? 0 : total / games
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function best<T>(
  items: T[],
  score: (item: T) => number,
): { item: T; score: number } | null {
  let winner: { item: T; score: number } | null = null
  for (const item of items) {
    const s = score(item)
    if (s > 0 && (winner === null || s > winner.score)) winner = { item, score: s }
  }
  return winner
}

function profileFor(name: string, roster: MarketPlayer[]): TeamProfile {
  const played = roster.filter((p) => p.stats.gamesPlayed >= MIN_GAMES)
  const shooters = played.filter(
    (p) => (p.stats.threePct ?? 0) >= SHOOTER_THREE_PCT,
  )
  const topShooter = best(shooters, (p) => p.stats.threePct ?? 0)
  const scorer = best(played, (p) =>
    perGame(p.stats.pointsTotal, p.stats.gamesPlayed),
  )
  const rebounder = best(played, (p) =>
    perGame(p.stats.reboundsTotal, p.stats.gamesPlayed),
  )
  const passer = best(played, (p) =>
    perGame(p.stats.assistsTotal, p.stats.gamesPlayed),
  )

  return {
    name,
    players: roster.length,
    avgHeightCm: mean(
      roster.map((p) => p.heightCm).filter((h): h is number => h != null),
    ),
    avgAge: mean(roster.map((p) => p.age).filter((a): a is number => a != null)),
    shooters: shooters.length,
    bestShooter: topShooter
      ? { name: topShooter.item.fullName, threePct: topShooter.score }
      : null,
    bigs: roster.filter((p) => (p.heightCm ?? 0) >= BIG_HEIGHT_CM).length,
    topScorer: scorer
      ? { name: scorer.item.fullName, ppg: scorer.score }
      : null,
    topRebounder: rebounder
      ? { name: rebounder.item.fullName, rpg: rebounder.score }
      : null,
    topPasser: passer ? { name: passer.item.fullName, apg: passer.score } : null,
  }
}

/** Every club in the league with a measured squad, biggest squads first. */
export async function leagueTeamProfiles(
  leagueSlug: string,
): Promise<TeamProfile[]> {
  const pool = await getMarketPool([leagueSlug], 0)
  const byTeam = new Map<string, MarketPlayer[]>()
  for (const p of pool) {
    if (!p.team) continue
    const list = byTeam.get(p.team.name)
    if (list) list.push(p)
    else byTeam.set(p.team.name, [p])
  }
  return [...byTeam.entries()]
    .map(([name, roster]) => profileFor(name, roster))
    .sort((a, b) => b.players - a.players)
}

/**
 * The league a free-text question is about, or null.
 *
 * Both names of the Spanish tiers are matched: the FEB renamed LEB Oro/Plata
 * to Primera/Segunda FEB, and coaches still use both.
 */
const LEAGUE_ALIASES: Array<[string, RegExp]> = [
  ["nba", /\bnba\b/i],
  ["euroleague", /\beuroleague\b|\beuroliga\b/i],
  ["acb", /\bacb\b|liga endesa/i],
  ["leb-oro", /\bleb\s*oro\b|primera\s*feb/i],
  ["leb-plata", /\bleb\s*plata\b|segunda\s*feb/i],
  ["eba", /\beba\b|tercera\s*feb/i],
]

export function detectLeagueSlug(text: string): string | null {
  for (const [slug, re] of LEAGUE_ALIASES) {
    if (re.test(text)) return slug
  }
  return null
}

function fmt(n: number | null, decimals = 1): string {
  return n == null ? "—" : n.toFixed(decimals)
}

/**
 * The profiles as a prompt block. One line per club so a model with a short
 * attention span can still scan it, and every number carries its unit.
 */
export function describeTeamProfiles(
  profiles: TeamProfile[],
  leagueSlug: string,
  locale: Locale,
): string {
  if (profiles.length === 0) return ""
  const league = leagueEconomics(leagueSlug).label
  const es = locale === "es"

  const header = es
    ? `EQUIPOS REALES DE ${league} (datos medidos de esta temporada) —`
    : `REAL ${league} CLUBS (measured, this season) —`
  const rule = es
    ? `Si la pregunta es qué equipo encaja, elige SOLO entre estos y justifícalo con estos números. No menciones clubes que no estén en la lista. "Tiradores" = jugadores por encima del ${SHOOTER_THREE_PCT * 100}% en triples; "altos" = ${BIG_HEIGHT_CM} cm o más.`
    : `If the question is which club fits, choose ONLY from these and justify it with these numbers. Never name a club that is not listed. "Shooters" = players above ${SHOOTER_THREE_PCT * 100}% from three; "bigs" = ${BIG_HEIGHT_CM} cm or taller.`

  const lines = profiles.map((p) => {
    const bits = [
      es
        ? `altura media ${fmt(p.avgHeightCm, 0)} cm`
        : `avg height ${fmt(p.avgHeightCm, 0)} cm`,
      es
        ? `${p.shooters} tiradores`
        : `${p.shooters} shooters`,
      p.bestShooter
        ? `${es ? "mejor" : "best"} ${p.bestShooter.name} ${(p.bestShooter.threePct * 100).toFixed(1)}%`
        : null,
      es ? `${p.bigs} altos` : `${p.bigs} bigs`,
      p.topScorer
        ? `${es ? "máx. anotador" : "top scorer"} ${p.topScorer.name} ${fmt(p.topScorer.ppg)} ${es ? "pts" : "pts"}`
        : null,
      p.topPasser
        ? `${es ? "máx. asistente" : "top passer"} ${p.topPasser.name} ${fmt(p.topPasser.apg)} ${es ? "as" : "ast"}`
        : null,
    ].filter((b): b is string => b !== null)
    return `- ${p.name}: ${bits.join(" · ")}`
  })

  return [header, rule, "", ...lines].join("\n")
}
