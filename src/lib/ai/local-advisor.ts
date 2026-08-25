import type { TeamProfile } from "@/lib/data/teams"
import type { PlayerProfile } from "@/lib/data/players"
import { getPlayerBySlug } from "@/lib/data/players"
import { getMarketPlayerBySlug } from "@/lib/market/pool"
import { getDb } from "@/lib/db/client"
import { leagues, playerSeasonStats, players, teams } from "@/lib/db/schema"
import { and, asc, eq, like, or, sql, type SQL } from "drizzle-orm"
import { formatStat } from "@/lib/format"
import type { Locale } from "@/lib/i18n/config"
import { detectIntent, INTENT_LABELS_ES, type Intent } from "@/lib/ai/intent"

export type { Intent } from "@/lib/ai/intent"

/** Pick the right string for the active locale. */
function pick(locale: Locale, en: string, es: string): string {
  return locale === "es" ? es : en
}

function intentLabel(intent: Intent, locale: Locale): string {
  return locale === "es" ? INTENT_LABELS_ES[intent] : INTENT_META[intent].label
}

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

const INTENT_META: Record<
  Intent,
  { label: string; emoji: string; color: string }
> = {
  defender: {
    label: "Defensive reinforcement",
    emoji: "🛡️",
    color: "from-blue-500/20 to-cyan-500/20",
  },
  scorer: {
    label: "Scorer / shooter",
    emoji: "🎯",
    color: "from-orange-500/20 to-red-500/20",
  },
  playmaker: {
    label: "Floor general",
    emoji: "🎮",
    color: "from-purple-500/20 to-pink-500/20",
  },
  wing: {
    label: "Versatile wing",
    emoji: "💪",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  big: {
    label: "Interior reinforcement",
    emoji: "🏀",
    color: "from-amber-500/20 to-orange-500/20",
  },
  cheap: {
    label: "Budget option",
    emoji: "💰",
    color: "from-slate-500/20 to-zinc-500/20",
  },
  star: {
    label: "Star move",
    emoji: "⭐",
    color: "from-yellow-500/20 to-amber-500/20",
  },
  general: {
    label: "General analysis",
    emoji: "🏀",
    color: "from-brand-500/20 to-brand-400/20",
  },
}

/**
 * There used to be a hand-written table of about forty real players here —
 * name, age, salary, three English adjectives — used as the shortlist whenever
 * the database returned no candidates.
 *
 * It was deleted because it was inventing things. "Buddy Hield · $21M · Elite
 * outside shooting" is not data: the figure was typed by a person, the age was
 * frozen at whatever it was the day it was written, and the card carrying it
 * looked exactly like the cards built from real valuations next to it. Asked
 * for CHEAPER options, it offered a $21M and a $33M contract, in English, on a
 * Spanish page.
 *
 * The shortlist now comes only from `findCandidates` — real players, priced
 * from our own valuations, scoped to the club's league. When that finds
 * nobody, the honest answer is no shortlist, not a stale one.
 */
function getPositionBreakdown(
  roster: TeamProfile["roster"],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of roster) {
    const pos = (p.position || "?").toUpperCase().charAt(0)
    counts[pos] = (counts[pos] || 0) + 1
  }
  return counts
}


function analyzeTeamGaps(
  roster: TeamProfile["roster"],
  locale: Locale,
): string {
  const counts = getPositionBreakdown(roster)
  const total = roster.length
  if (total === 0)
    return pick(
      locale,
      "Not enough roster information available.",
      "No hay suficiente información de la plantilla.",
    )

  const guards = (counts["G"] || 0) + (counts["1"] || 0) + (counts["2"] || 0)
  const wings = (counts["F"] || 0) + (counts["3"] || 0) + (counts["4"] || 0)
  const bigs = (counts["C"] || 0) + (counts["5"] || 0)

  const gaps: string[] = []
  if (guards / total < 0.3)
    gaps.push(
      pick(
        locale,
        "Backcourt reinforcements (point guards and shooting guards)",
        "Refuerzos en el backcourt (bases y escoltas)",
      ),
    )
  if (wings / total < 0.25)
    gaps.push(
      pick(locale, "Help at the forward spots", "Ayuda en las posiciones de alero"),
    )
  if (bigs / total < 0.2)
    gaps.push(
      pick(locale, "Limited interior depth", "Fondo de armario interior limitado"),
    )
  if (gaps.length === 0)
    gaps.push(
      pick(
        locale,
        "Well-balanced roster — any position is viable",
        "Plantilla bien equilibrada — cualquier posición es viable",
      ),
    )

  return gaps[0]
}

/**
 * One concrete sentence for the rule-based advisor, built from what we
 * actually know: the gap detected in the roster, and the cheapest of the
 * candidates we are about to show. No model involved.
 */
/** Exported for tests: the only prose the no-AI path produces. */
export function buildFallbackSummary({
  label,
  gap,
  recs,
  rosterSize,
  locale,
}: {
  label: string
  gap: string
  recs: Recruit[]
  rosterSize: number
  locale: Locale
}): string {
  const need = label.toLowerCase()
  const top = recs[0]
  const shortlist = recs.length

  if (!top) {
    return pick(
      locale,
      `We could not find a **${need}** in the leagues we cover that fits this roster. Widening the budget or the league would open up options.`,
      `No hemos encontrado ningún **${need}** en las ligas que cubrimos que encaje en esta plantilla. Ampliar el presupuesto o la liga abriría opciones.`,
    )
  }

  return pick(
    locale,
    `Looking at your ${rosterSize}-player roster, the clearest hole is here: ${gap.toLowerCase()}. These ${shortlist} are the **${need}** options that fit it best — **${top.name}** is the one we would start with, at around ${top.contractValue}.`,
    `Mirando tu plantilla de ${rosterSize} jugadores, el hueco más claro es este: ${gap.toLowerCase()}. Estas son las ${shortlist} opciones de **${need}** que mejor encajan — por **${top.name}** empezaríamos nosotros, en torno a ${top.contractValue}.`,
  )
}

function getLeagueBadge(league: string): string {
  const lname = league.toLowerCase()
  if (lname.includes("nba")) return "NBA"
  if (lname.includes("acb") || lname.includes("endesa")) return "ACB"
  return "EuroLeague"
}

export async function buildLocalAdvice(
  team: TeamProfile,
  userMessage: string,
  locale: Locale = "en",
  // Real, DB-grounded candidates (priced & scoped to adjacent leagues). When
  // provided they replace the legacy hardcoded star list, so even the
  // no-AI-configured fallback recommends actual players we have data for.
  dbCandidates?: Recruit[],
): Promise<AdvisorOutput> {
  const specific = await findPlayerInQuery(userMessage)
  if (specific) {
    return await buildPlayerSpecificAdvice(team, specific, locale, dbCandidates)
  }

  const intent = detectIntent(userMessage)
  // No hand-written fallback any more: an empty shortlist is the truthful
  // answer when we have nobody real to put in it.
  const recs = dbCandidates?.slice(0, 3) ?? []

  return assembleAdvice({ team, intent, locale, recs })
}

/**
 * The structured answer — team header, gap, ranked shortlist, caveats — with
 * whatever prose you hand it.
 *
 * Split out so the AI path can show the SAME real player cards under the
 * model's own words. Before this, connecting a model made the shortlist
 * disappear: you got the cards with prices and stats only when the AI was off,
 * and a wall of text when it was on.
 */
export function assembleAdvice({
  team,
  intent,
  locale,
  recs,
  analysis,
}: {
  team: TeamProfile
  intent: Intent
  locale: Locale
  recs: Recruit[]
  /** The model's answer. Omit for the rule-based summary. */
  analysis?: string
}): AdvisorOutput {
  const meta = INTENT_META[intent]
  const label = intentLabel(intent, locale)
  const gap = analyzeTeamGaps(team.roster, locale)

  const priorities = [
    {
      label: pick(locale, "High priority", "Prioridad alta"),
      color: "bg-brand-500/20 text-brand-300 border-brand-500/30",
    },
    {
      label: pick(locale, "Solid option", "Opción sólida"),
      color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    },
    {
      label: pick(locale, "Value bet", "Apuesta de valor"),
      color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    },
  ]

  return {
    intent,
    intentLabel: label,
    intentEmoji: meta.emoji,
    team: {
      name: team.name,
      league: team.league.name,
      leagueBadge: getLeagueBadge(team.league.name),
      rosterSize: team.roster.length,
      topPlayers: team.roster.slice(0, 4).map((p) => p.fullName),
    },
    // Say something the reader could not have worked out by looking at the
    // screen. The old line ("this signing could bring a differential profile
    // to the rotation") was true of every signing ever made, so it read as
    // filler — which is worse here than in the AI path, because this is the
    // answer shown to people who have not connected a model.
    analysis:
      analysis ??
      buildFallbackSummary({
        label,
        gap,
        recs,
        rosterSize: team.roster.length,
        locale,
      }),
    gap,
    recommendations: recs.slice(0, priorities.length).map((r, i) => ({
      ...r,
      priority: priorities[i].label,
      priorityColor: priorities[i].color,
    })),
    considerations: [
      pick(
        locale,
        "Check the salary cap space before opening negotiations",
        "Revisa el espacio salarial antes de abrir negociaciones",
      ),
      pick(
        locale,
        "Prioritise profiles that complement (not duplicate) your key players",
        "Prioriza perfiles que complementen (no dupliquen) a tus jugadores clave",
      ),
      pick(
        locale,
        "The market moves fast — values are current estimates",
        "El mercado se mueve rápido — los valores son estimaciones actuales",
      ),
      pick(
        locale,
        "Factor in the buy-out clause if the player is under contract",
        "Ten en cuenta la cláusula de salida si el jugador está bajo contrato",
      ),
    ],
  }
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

export { findPlayerInQuery, formatStat, estimateContractValue, getLeagueBadge }

function estimateContractValue(
  profile: PlayerProfile,
  locale: Locale = "en",
): string {
  const latest = profile.seasons[0]
  if (!latest || latest.pointsTotal === null || latest.gamesPlayed === 0) return "N/A"
  const ppg = latest.pointsTotal / latest.gamesPlayed
  if (ppg >= 25) return "Max / $50M+"
  if (ppg >= 20) return "All-Star / $30-50M"
  if (ppg >= 15) return pick(locale, "Starter / $15-25M", "Titular / $15-25M")
  if (ppg >= 10) return pick(locale, "Rotation / $5-12M", "Rotación / $5-12M")
  if (ppg >= 5) return pick(locale, "Role / $1-4M", "Rol / $1-4M")
  return pick(locale, "Minimum / <€1M", "Mínimo / <€1M")
}

async function buildPlayerSpecificAdvice(
  team: TeamProfile,
  profile: PlayerProfile,
  locale: Locale = "en",
  /** Real DB candidates to offer alongside the player the coach named. */
  alternatives?: Recruit[],
): Promise<AdvisorOutput> {
  const latest = profile.seasons[0]
  const age = null as number | null

  const gp = latest?.gamesPlayed || 1
  const ppg = latest?.pointsTotal !== null && latest?.pointsTotal !== undefined ? latest.pointsTotal / gp : null
  const apg = latest?.assistsTotal !== null && latest?.assistsTotal !== undefined ? latest.assistsTotal / gp : null
  const rpg = latest?.reboundsTotal !== null && latest?.reboundsTotal !== undefined ? latest.reboundsTotal / gp : null
  const spg = latest?.stealsTotal !== null && latest?.stealsTotal !== undefined ? latest.stealsTotal / gp : null
  const bpg = latest?.blocksTotal !== null && latest?.blocksTotal !== undefined ? latest.blocksTotal / gp : null

  const stats = latest
    ? [
        ppg !== null ? `${formatStat(ppg)} PPG` : null,
        rpg !== null ? `${formatStat(rpg)} RPG` : null,
        apg !== null ? `${formatStat(apg)} APG` : null,
        spg !== null ? `${formatStat(spg)} SPG` : null,
        bpg !== null ? `${formatStat(bpg)} BPG` : null,
      ].filter(Boolean)
    : []

  const statsLine =
    stats.length > 0
      ? stats.join(" · ")
      : pick(
          locale,
          "No season stats available",
          "Sin estadísticas de temporada disponibles",
        )
  const currentTeam =
    profile.team?.name ??
    pick(locale, "Free agent / no team", "Agente libre / sin equipo")
  const leagueLine = `${profile.league.name}${profile.nationality ? ` · ${profile.nationality}` : ""}`

  const intent: Intent = "scorer"

  const strengths: string[] = []
  if (ppg !== null && ppg >= 15) {
    strengths.push(pick(locale, "Proven scorer", "Anotador contrastado"))
  }
  if (apg !== null && apg >= 5) {
    strengths.push(pick(locale, "Playmaking", "Generación de juego"))
  }
  if (rpg !== null && rpg >= 7) {
    strengths.push(pick(locale, "Solid rebounder", "Reboteador sólido"))
  }
  if (spg !== null && spg >= 1.5) {
    strengths.push(pick(locale, "Creates steals", "Genera robos"))
  }
  if (bpg !== null && bpg >= 1) {
    strengths.push(pick(locale, "Rim protection", "Protección del aro"))
  }
  if (strengths.length === 0)
    strengths.push(
      pick(locale, "Complementary profile", "Perfil complementario"),
      pick(locale, "Available via trade", "Disponible vía traspaso"),
    )

  const sameLeague = profile.league.slug === team.league.slug

  const fitParts: string[] = []
  if (sameLeague) {
    fitParts.push(
      pick(
        locale,
        `Already plays in ${profile.league.name}, so the adaptation would be immediate.`,
        `Ya juega en ${profile.league.name}, así que la adaptación sería inmediata.`,
      ),
    )
  } else {
    fitParts.push(
      pick(
        locale,
        `Comes from ${profile.league.name} — needs an adaptation period to the ${team.league.name} game.`,
        `Viene de ${profile.league.name} — necesita un periodo de adaptación al juego de ${team.league.name}.`,
      ),
    )
  }
  if (ppg !== null && ppg >= 18) {
    fitParts.push(
      pick(
        locale,
        "Differential scorer — will take the key clutch possessions.",
        "Anotador diferencial — asumirá las posesiones clutch clave.",
      ),
    )
  }

  // Alternatives beside the player the coach asked about — real candidates
  // only, and never the player himself.
  const alternativeRecs = (alternatives ?? [])
    .filter((r) => r.name !== profile.fullName)
    .slice(0, 2)

  const alternative = (r: Recruit) => ({
    ...r,
    priority: pick(locale, "Alternative option", "Opción alternativa"),
    priorityColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  })

  const positionLabel = profile.position ?? pick(locale, "Position N/A", "Posición N/D")

  const valuationEur = await getMarketPlayerBySlug(profile.slug)
    .then((m) => m?.valuation?.eur ?? null)
    .catch(() => null)

  return {
    intent,
    intentLabel: pick(
      locale,
      `Analysis of ${profile.fullName}`,
      `Análisis de ${profile.fullName}`,
    ),
    intentEmoji: "🔍",
    team: {
      name: team.name,
      league: team.league.name,
      leagueBadge: getLeagueBadge(team.league.name),
      rosterSize: team.roster.length,
      topPlayers: team.roster.slice(0, 4).map((p) => p.fullName),
    },
    analysis: pick(
      locale,
      `**${profile.fullName}** (${positionLabel}) currently at **${currentTeam}** (${leagueLine}). ${statsLine}. ${fitParts.join(" ")}`,
      `**${profile.fullName}** (${positionLabel}) actualmente en **${currentTeam}** (${leagueLine}). ${statsLine}. ${fitParts.join(" ")}`,
    ),
    gap: sameLeague
      ? pick(
          locale,
          `Direct fit with the ${team.league.name} roster`,
          `Encaje directo con la plantilla de ${team.league.name}`,
        )
      : pick(
          locale,
          `Cross-league fit: requires a salary review and adaptation to the ${team.league.name} system`,
          `Encaje entre ligas: requiere revisión salarial y adaptación al sistema de ${team.league.name}`,
        ),
    recommendations: [
      {
        name: profile.fullName,
        position: profile.position ?? "N/A",
        league: getLeagueBadge(profile.league.name) as
          | "NBA"
          | "EuroLeague"
          | "ACB",
        age: age ?? null,
        // The real valuation, the same one every other card on the site
        // shows. `estimateContractValue` is only reached when we have not
        // priced this player at all — and it hands back dollar bands on a
        // euro-denominated site, which is why it is now the last resort
        // rather than the first answer.
        contractValue:
          valuationEur != null
            ? formatAdvisorEur(valuationEur)
            : estimateContractValue(profile, locale),
        strengths,
        fit: fitParts.join(" "),
        market: pick(locale, "Custom evaluation", "Evaluación personalizada"),
        priority: pick(locale, "Requested candidate", "Candidato solicitado"),
        priorityColor: "bg-brand-500/20 text-brand-300 border-brand-500/30",
      },
      ...alternativeRecs.map(alternative),
    ],
    considerations: [
      pick(
        locale,
        `Check ${profile.fullName}'s current contract situation with ${currentTeam}`,
        `Revisa la situación contractual actual de ${profile.fullName} con ${currentTeam}`,
      ),
      sameLeague
        ? pick(
            locale,
            "Being in the same league, the salary fit and buy-out are more predictable",
            "Al estar en la misma liga, el encaje salarial y la cláusula son más predecibles",
          )
        : pick(
            locale,
            "A cross-league move involves buy-out clauses and adaptation periods",
            "Un movimiento entre ligas implica cláusulas de salida y periodos de adaptación",
          ),
      pick(
        locale,
        "Compare his statistical profile against your current core before negotiating",
        "Compara su perfil estadístico con tu núcleo actual antes de negociar",
      ),
      pick(
        locale,
        "Consider the impact on the salary cap and locker-room chemistry",
        "Considera el impacto en el tope salarial y la química del vestuario",
      ),
    ],
  }
}


/** `€4.2 M` / `€850 K` — the same shape the market cards use. */
function formatAdvisorEur(eur: number): string {
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`
  if (eur >= 1_000) return `€${Math.round(eur / 1_000)}K`
  return `€${Math.round(eur)}`
}
