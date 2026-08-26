import type { PlayerProfile } from "@/lib/data/players"
import { getPlayerBySlug } from "@/lib/data/players"
import { getDb } from "@/lib/db/client"
import { leagues, playerSeasonStats, players, teams } from "@/lib/db/schema"
import { and, asc, eq, like, or, sql, type SQL } from "drizzle-orm"
import { formatStat } from "@/lib/format"
import { type Intent } from "@/lib/ai/intent"

export type { Intent } from "@/lib/ai/intent"

export type Recruit = {
  name: string
  position: string
  // Widened from the old NBA/EuroLeague/ACB union so DB-grounded candidates
  // from any league (ACB, Primera FEB / Segunda FEB, Tercera FEB) can flow through unchanged.
  league: string
  /**
   * Null when we do not know it. It used to be a bare `number`, which forced
   * every caller to substitute 0 for "unknown" — and the card duly told
   * coaches that Victor Wembanyama is 0 años.
   */
  age: number | null
  contractValue: string
  strengths: string[]
  fit: string
  market: string
  /**
   * Real per-game production, already formatted for display. The card used to
   * show a price and an adjective and nothing else, which is what "it gives me
   * no information" meant. Optional because the legacy hardcoded shortlist has
   * no season data behind it.
   */
  stats?: Array<{ label: string; value: string }>
  /** Estimated annual salary, formatted. Distinct from the transfer value. */
  annual?: string | null
}

export type AdvisorOutput = {
  intent: Intent
  intentLabel: string
  intentEmoji: string
  team: {
    name: string
    league: string
    leagueBadge: string
    rosterSize: number
    topPlayers: string[]
  }
  analysis: string
  gap: string
  recommendations: Array<Recruit & { priority: string; priorityColor: string }>
  considerations: string[]
}

function getLeagueBadge(league: string): string {
  const lname = league.toLowerCase()
  if (lname.includes("nba")) return "NBA"
  if (lname.includes("acb") || lname.includes("endesa")) return "ACB"
  return "EuroLeague"
}

const QUERY_STOPWORDS = new Set([
  "que",
  "tal",
  "como",
  "es",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "en",
  "por",
  "para",
  "con",
  "sin",
  "y",
  "o",
  "u",
  "a",
  "fit",
  "encaja",
  "encajaria",
  "ficharia",
  "fichaje",
  "jugador",
  "seria",
  "buena",
  "buen",
  "opcion",
  "opinion",
  "sobre",
  "tipo",
  "cual",
  "cuando",
  "donde",
  "este",
  "esta",
  "estos",
  "estas",
  "eso",
  "esa",
  "ese",
  "muy",
  "mas",
  "poco",
  "algo",
  "algun",
  "alguna",
  "alguno",
  "nada",
  "nadie",
  "nunca",
  "siempre",
  "puede",
  "podria",
  "deberia",
  "haria",
  "hace",
  "hacer",
  "tener",
  "tiene",
  "tenia",
  "habia",
  "ha",
  "han",
  "he",
  "hay",
  "del",
  "al",
  "lo",
  // English query words
  "the",
  "and",
  "for",
  "with",
  "without",
  "what",
  "which",
  "how",
  "would",
  "could",
  "should",
  "about",
  "think",
  "good",
  "great",
  "sign",
  "signing",
  "player",
  "team",
  "option",
  "want",
  "need",
  "looking",
  "strong",
  "best",
])

function tokenizeQuery(query: string): string[] {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !QUERY_STOPWORDS.has(t))
}

async function findPlayerInQuery(query: string): Promise<PlayerProfile | null> {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return null

  // Build a single combined query: every token must appear somewhere in the
  // player's full name (case-insensitive). This collapses the N round-trips
  // of the previous implementation into one DB hit.
  const db = getDb()
  const nameLower = sql<string>`lower(concat(${players.firstName}, ' ', ${players.lastName}))`

  // 1. Combined AND query: every token must match. Skipped for a one-word
  //    message, where it degenerates into the same loose substring match that
  //    step 3 exists to avoid.
  let row: { slug: string; fullName: string } | undefined
  if (tokens.length >= 2) {
    const andConditions = tokens.map((t) => like(nameLower, `%${t}%`))
    row = await pickPlayer(db, and(...andConditions))
  }

  // 2. If nothing matched, try pairwise combinations of the first tokens
  //    (handles "Doncic", "Luka Doncic", "Doncic Luka" by matching any
  //    adjacent pair) and OR them together.
  if (!row && tokens.length >= 2) {
    const pairs: ReturnType<typeof like>[] = []
    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = `%${tokens[i]}%${tokens[i + 1]}%`
      pairs.push(like(nameLower, pair))
    }
    row = await pickPlayer(db, or(...pairs))
  }

  // 3. Last resort: a single token, but only if it IS somebody's SURNAME.
  //
  //    This used to be `like('%token%')` over the whole name, which is how
  //    "dame jugadores más económicos que puedan cumplir" — give me cheaper
  //    players — was read as a question about Dame Sarr, a EuroLeague guard
  //    averaging 0.0 points, who was then presented to an NBA club as the
  //    requested candidate. A Spanish imperative is not a scouting request.
  //
  //    Requiring the whole surname is what separates the two: "Doncic" and
  //    "Wembanyama" still resolve on their own, while "dame", "quiero" and
  //    "busco" match nothing, because they are first names at best and the
  //    identifying half of a name is the last one.
  if (!row) {
    const surnameLower = sql<string>`lower(${players.lastName})`
    const exact = tokens.map((t) => eq(surnameLower, t))
    row = await pickPlayer(db, or(...exact))
  }

  if (!row) return null
  return getPlayerBySlug(row.slug)
}

async function pickPlayer(
  db: ReturnType<typeof getDb>,
  whereClause: SQL | undefined,
): Promise<{ slug: string; fullName: string } | undefined> {
  if (!whereClause) return undefined
  const rows = await db
    .select({
      slug: players.slug,
      fullName: sql<string>`concat(${players.firstName}, ' ', ${players.lastName})`,
    })
    .from(players)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(leagues, eq(playerSeasonStats.leagueId, leagues.id))
    .leftJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .where(whereClause)
    .orderBy(asc(sql`length(concat(${players.firstName}, ' ', ${players.lastName}))`))
    .limit(1)
  const r = rows[0]
  if (!r) return undefined
  return { slug: r.slug, fullName: r.fullName }
}

export { findPlayerInQuery, formatStat, getLeagueBadge }
