import type { TeamProfile } from "@/lib/data/teams"
import type { PlayerProfile } from "@/lib/data/players"
import { formatStat, getLeagueBadge } from "@/lib/ai/local-advisor"
import { chatComplete, supportsNativeWebSearch, type ChatMessage } from "@/lib/ai/chat"
import type { AiProvider } from "@/lib/ai/providers"
import type { Locale } from "@/lib/i18n/config"
import { aiLanguageDirective, aiLanguageName } from "@/lib/ai/language"
import { houseStyle, promptCopy, type PromptCopy } from "@/lib/ai/prompt-copy"
import type { Candidate } from "@/lib/market/candidates"
import type { MarketPlayer } from "@/lib/market/pool"
import { tradeVerdictLabel, type TradeScenario } from "@/lib/market/trade"
import type { WebResearch } from "@/lib/market/web-research"
import { formatEur } from "@/lib/market/league-strength"
import { valuationTierLabel, type Valuation } from "@/lib/market/valuation"
import { singleSigningCap, type ClubBudget } from "@/lib/market/club-budgets"
import type { RosterAnalysis } from "@/lib/market/roster"
import { natFilterLabel, type NatFilter } from "@/lib/market/nationality"
import { isMarketOperation, type MarketOperation } from "@/lib/ai/intent"

export type AdvisorHistoryMessage = {
  role: "user" | "assistant"
  content: string
}

/** The engine to drive a single advisor response, resolved per user/request. */
export type AdvisorEngine = {
  provider: AiProvider
  model: string
  apiKey: string | null
}

export type GenerateAdvisorInput = {
  team: TeamProfile
  userMessage: string
  history: AdvisorHistoryMessage[]
  playerProfile?: PlayerProfile | null
  locale: Locale
  /** Real, priced candidates from our DB for the detected need. */
  candidates?: Candidate[]
  /** Valuation of the player named in the query, if any. */
  namedValuation?: Valuation | null
  /** Trade packages that balance the value of the named (outgoing) player. */
  trade?: { outgoing: MarketPlayer; scenarios: TradeScenario[] } | null
  /** Untrusted live web context (only when a search backend is configured). */
  web?: WebResearch | null
  /** Public-data estimate of the user's club budget. */
  teamBudget?: ClubBudget | null
  /** Kind of market move being asked about. */
  operation?: MarketOperation
  /** Cupo / passport requirement detected in the question. */
  nationalityFilter?: NatFilter
  /** Valued own roster (for release / renewal operations). */
  roster?: RosterAnalysis | null
}

export type AdvisorResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string }

function buildPlayerContext(profile: PlayerProfile, copy: PromptCopy): string {
  const latest = profile.seasons[0]
  const L = copy.player

  const lines: string[] = []
  lines.push(L.heading)
  lines.push(`- ${L.name}: ${profile.fullName}`)
  lines.push(`- ${L.league}: ${profile.league.name} (${profile.league.region})`)
  lines.push(`- ${L.team}: ${profile.team ? profile.team.name : L.freeAgent}`)
  if (profile.position) lines.push(`- ${L.position}: ${profile.position}`)
  if (profile.nationality) lines.push(`- ${L.nationality}: ${profile.nationality}`)
  if (profile.heightCm)
    lines.push(`- ${L.height}: ${(profile.heightCm / 100).toFixed(2)} m`)

  if (latest) {
    const gp = latest.gamesPlayed || 1
    lines.push("")
    lines.push(L.lastSeason(latest.seasonName))
    if (latest.gamesPlayed !== null)
      lines.push(`- ${L.games}: ${latest.gamesPlayed}`)
    if (latest.pointsTotal !== null)
      lines.push(`- ${L.points}: ${formatStat(latest.pointsTotal / gp)}`)
    if (latest.reboundsTotal !== null)
      lines.push(`- ${L.rebounds}: ${formatStat(latest.reboundsTotal / gp)}`)
    if (latest.assistsTotal !== null)
      lines.push(`- ${L.assists}: ${formatStat(latest.assistsTotal / gp)}`)
    if (latest.stealsTotal !== null)
      lines.push(`- ${L.steals}: ${formatStat(latest.stealsTotal / gp)}`)
    if (latest.blocksTotal !== null)
      lines.push(`- ${L.blocks}: ${formatStat(latest.blocksTotal / gp)}`)
  } else {
    lines.push("")
    lines.push(L.noStats)
  }

  lines.push("")
  lines.push(L.dataRule)

  return lines.join("\n")
}

function buildTeamContext(
  team: TeamProfile,
  copy: PromptCopy,
  budget?: ClubBudget | null,
): string {
  const L = copy.team
  const lines: string[] = []
  lines.push(L.heading)
  lines.push(`- ${L.name}: ${team.name}`)
  lines.push(`- ${L.league}: ${team.league.name} (${team.league.region})`)
  lines.push(`- ${L.rosterSize}: ${team.roster.length}`)
  if (budget) {
    const cap = singleSigningCap(budget.eur)
    lines.push(
      copy.budgetLine({
        source:
          budget.source === "known"
            ? copy.budgetSourceKnown
            : copy.budgetSourceEstimate,
        budget: formatEur(budget.eur),
        cap: formatEur(cap),
      }),
    )
  }

  const positions = team.roster.reduce<Record<string, number>>((acc, p) => {
    const pos = (p.position || "?").toUpperCase().charAt(0)
    acc[pos] = (acc[pos] ?? 0) + 1
    return acc
  }, {})
  const posLine = Object.entries(positions)
    .map(([k, v]) => `${k}:${v}`)
    .join(" · ")
  if (posLine) lines.push(`- ${L.positions}: ${posLine}`)

  if (team.roster.length > 0) {
    const names = team.roster
      .slice(0, 12)
      .map((p) => `${p.fullName}${p.position ? ` (${p.position})` : ""}`)
      .join(", ")
    const rest =
      team.roster.length > 12 ? `, ${L.andMore(team.roster.length - 12)}` : ""
    lines.push(`- ${L.core}: ${names}${rest}`)
  }
  return lines.join("\n")
}

function buildCandidatesContext(
  candidates: Candidate[],
  copy: PromptCopy,
  locale: Locale,
): string {
  if (!candidates.length) return ""
  const lines = candidates.map((c) => {
    const p = c.player
    const bits = [p.position ?? "?", p.league.name]
    if (p.team) bits.push(p.team.name)
    if (p.age) bits.push(`${p.age} ${copy.yearsOld}`)
    return `- ${p.fullName} — ${bits.join(", ")}. ${copy.estValue} ${formatEur(p.valuation.eur)} (${valuationTierLabel(p.valuation.tier, p.valuation.leagueSlug, locale)}, ${copy.rating} ${p.valuation.rating}/100). ${c.reason}.`
  })
  // The closed-list rule is stated once, up in the spine. Repeating it here —
  // which is what the prompt used to do — spends the model's attention on
  // re-reading a rule it already has instead of on the six players below it.
  return ["", copy.candidatesHeading, copy.candidatesIntro, ...lines].join("\n")
}

function buildValuationContext(
  name: string,
  v: Valuation,
  copy: PromptCopy,
  locale: Locale,
): string {
  return [
    "",
    copy.valuationHeading,
    copy.valuationLine({
      name,
      value: formatEur(v.eur),
      annual: formatEur(v.annualEur),
      tier: valuationTierLabel(v.tier, v.leagueSlug, locale),
      rating: v.rating,
      confidence: v.confidence,
    }),
  ].join("\n")
}

function buildTradeContext(
  trade: {
    outgoing: MarketPlayer
    scenarios: TradeScenario[]
  },
  locale: Locale,
  copy: PromptCopy,
): string {
  if (!trade.scenarios.length) return ""
  const lines = trade.scenarios.slice(0, 5).map((s) => {
    const pieces = s.incoming
      .map(
        (p) =>
          `${p.fullName} (${p.team?.name ?? copy.noTeam}, ${formatEur(p.valuation.eur)})`,
      )
      .join(" + ")
    return `- ${pieces} = ${formatEur(s.combinedValueEur)} · balance ${s.balance.toFixed(2)} · ${tradeVerdictLabel(s.verdictKey, locale)}`
  })
  return [
    "",
    copy.tradeHeading({
      name: trade.outgoing.fullName,
      value: formatEur(trade.outgoing.valuation.eur),
    }),
    copy.tradeIntro,
    ...lines,
  ].join("\n")
}

function buildWebContext(web: WebResearch, copy: PromptCopy): string {
  if (!web.enabled || !web.snippets.length) return ""
  const lines = web.snippets.map(
    (s, i) =>
      `[${copy.webSourceLabel} ${i + 1}: ${s.title || s.url}](${s.url}): ${s.content}`,
  )
  return [
    "",
    copy.webHeading,
    copy.webIntro,
    copy.webCiteRule,
    ...lines,
  ].join("\n")
}

function operationGuidance(op: MarketOperation, copy: PromptCopy): string {
  return op === "general" ? "" : (copy.operation[op] ?? "")
}

function buildRosterContext(
  roster: RosterAnalysis,
  copy: PromptCopy,
  locale: Locale,
): string {
  const fmt = (p: RosterAnalysis["keep"][number]) =>
    `- ${p.fullName} (${p.position ?? "?"}${p.age ? `, ${p.age} ${copy.yearsOld}` : ""}) — ${valuationTierLabel(p.valuation.tier, p.valuation.leagueSlug, locale)}, ${copy.rating} ${p.valuation.rating}/100, ${copy.estValue} ${formatEur(p.valuation.eur)}`
  return [
    "",
    copy.rosterHeading(roster.size),
    copy.rosterKeep,
    ...roster.keep.map(fmt),
    copy.rosterRelease,
    ...roster.release.map(fmt),
  ].join("\n")
}

/**
 * The advisor's own voice, in the reader's language.
 *
 * It used to be ~35 lines of English rules wrapped around a handful of
 * translated fragments, which is the shape that produced the two complaints
 * this replaces: the model mixed languages (it was reading English orders and
 * being told to answer in Spanish), and it contradicted itself — a "you can
 * answer about ANY basketball topic" section sitting directly above a CLOSED
 * LIST rule that forbade naming anybody outside a six-player shortlist. Ask it
 * who the best point guard in the ACB is and both rules fire at once.
 *
 * The closed list is a rule about RECOMMENDATIONS, so it is applied only when
 * the question is actually a market question (see `marketMode` below).
 */
type AdvisorVoice = {
  role: string
  scope: string
  teamLine: (badge: string) => string
  citeHeading: string
  contextHeading: string
}

const VOICE: Record<Locale, AdvisorVoice> = {
  en: {
    role: "You are a veteran basketball analyst and front-office advisor. You know the game worldwide — NBA, EuroLeague, Liga ACB, FEB (LEB Oro/Plata/EBA), LNB, Lega A, ABA, BSL, NBL, BBL, the Greek league, Brazil, Argentina — and you talk to a general manager the way a trusted colleague does: straight, with judgement, and with the reasoning in view.",
    scope:
      "Any basketball question is fair game: a player, a coach, a club, a league, the rules, history, tactics, what the press is saying. Answer it the way an expert would in conversation — not as a form to be filled in.",
    teamLine: (badge) =>
      `The user's club plays in the ${badge}. Any move has to fit that league's level, salaries and roster rules.`,
    citeHeading: "## Citing the web context",
    contextHeading: "# Context you have been given",
  },
  es: {
    role: "Eres un analista de baloncesto veterano y asesor de dirección deportiva. Conoces el juego en todo el mundo — NBA, EuroLeague, Liga ACB, FEB (LEB Oro/Plata/EBA), LNB, Lega A, ABA, BSL, NBL, BBL, la liga griega, Brasil, Argentina — y hablas con un director deportivo como lo haría un colega de confianza: claro, con criterio y enseñando el razonamiento.",
    scope:
      "Cualquier pregunta de baloncesto vale: un jugador, un entrenador, un club, una liga, las reglas, la historia, la táctica, lo que se dice en la prensa. Contéstala como la contestaría un experto en una conversación, no como quien rellena un formulario.",
    teamLine: (badge) =>
      `El club del usuario juega en la ${badge}. Cualquier movimiento tiene que encajar en el nivel, los sueldos y las normas de plantilla de esa liga.`,
    citeHeading: "## Cómo citar el contexto web",
    contextHeading: "# Contexto que se te ha dado",
  },
}

function advisorVoice(locale: Locale): AdvisorVoice {
  return VOICE[locale] ?? VOICE.en
}

/**
 * Is this a question about moving players, or a question about basketball?
 *
 * Only the first kind gets the shortlist, the budget ceiling and the roster
 * breakdown. The second kind used to get all three anyway, which is why
 * "¿quién es el mejor base de la ACB?" came back as six replacement signings
 * nobody had asked for.
 */
function isMarketQuestion(input: GenerateAdvisorInput): boolean {
  return isMarketOperation(input.operation ?? "general")
}

/**
 * Should the model be held to the closed list of players it may put forward?
 *
 * Only when there IS a list. Telling a model "the only players you may name
 * are the ones under 'Verified candidates'" when no such section was rendered
 * leaves it with nowhere to go, and what comes back is a refusal or a
 * paragraph about not being able to help.
 */
function hasClosedList(input: GenerateAdvisorInput): boolean {
  return isMarketQuestion(input) && (input.candidates?.length ?? 0) > 0
}

/** Exported for tests: asserts the prompt is built in the requested language. */
export function buildSystemPrompt(input: GenerateAdvisorInput): string {
  const copy = promptCopy(input.locale)
  const voice = advisorVoice(input.locale)
  const language = aiLanguageName(input.locale)
  const market = isMarketQuestion(input)
  const closedList = hasClosedList(input)
  const leagueBadge = getLeagueBadge(input.team.league.name)
  const teamCtx = buildTeamContext(input.team, copy, input.teamBudget)
  const playerCtx = input.playerProfile
    ? "\n\n" + buildPlayerContext(input.playerProfile, copy)
    : ""
  const marketCtx = [
    market && input.operation && input.operation !== "general"
      ? `\n${copy.operationHeading}\n${operationGuidance(input.operation, copy)}`
      : "",
    market && input.nationalityFilter && input.nationalityFilter !== "any"
      ? `\n${copy.cupoHeading}\n${copy.cupoRule(natFilterLabel(input.nationalityFilter, input.locale))}`
      : "",
    market && input.candidates
      ? buildCandidatesContext(input.candidates, copy, input.locale)
      : "",
    market && input.roster
      ? buildRosterContext(input.roster, copy, input.locale)
      : "",
    input.namedValuation && input.playerProfile
      ? buildValuationContext(
          input.playerProfile.fullName,
          input.namedValuation,
          copy,
          input.locale,
        )
      : "",
    input.trade ? buildTradeContext(input.trade, input.locale, copy) : "",
    input.web ? buildWebContext(input.web, copy) : "",
  ]
    .filter(Boolean)
    .join("\n")

  const hasWeb = Boolean(input.web?.enabled && input.web.snippets.length)

  return [
    voice.role,
    ``,
    aiLanguageDirective(input.locale),
    ``,
    voice.scope,
    // The closed list is about who you can PUT FORWARD, so it only appears
    // when there is a priced shortlist to put forward.
    closedList
      ? `${copy.onlyListedPlayers} ${copy.fundingRule}`
      : copy.knowledgeRule,
    ``,
    houseStyle(input.locale),
    ...(hasWeb
      ? [
          ``,
          voice.citeHeading,
          copy.webCiteRule,
          `${copy.noWebInfo} → ${
            input.locale === "es"
              ? "dilo así, en una frase, en lugar de inventar."
              : "say exactly that, in one sentence, rather than inventing."
          }`,
        ]
      : []),
    ``,
    voice.contextHeading,
    teamCtx,
    ``,
    voice.teamLine(leagueBadge),
    playerCtx,
    marketCtx,
    ``,
    // Repeated last on purpose. The context carries names and clubs in no
    // particular language, and a model that has just read a long block drifts
    // towards whatever it read; the closing line is the one it weighs most.
    `${aiLanguageDirective(input.locale)} (${language})`,
  ]
    .join("\n")
    // Sections drop out depending on the question, and each one leaves its
    // spacer behind. Runs of blank lines read to a model as a break in the
    // document.
    .replace(/\n{3,}/g, "\n\n")
}

export async function generateAdvisorResponse(
  input: GenerateAdvisorInput,
  engine: AdvisorEngine,
): Promise<AdvisorResult> {
  const messages: ChatMessage[] = [
    ...input.history.slice(-8),
    { role: "user", content: input.userMessage },
  ]

  const result = await chatComplete({
    provider: engine.provider,
    model: engine.model,
    apiKey: engine.apiKey,
    system: buildSystemPrompt(input),
    messages,
    maxTokens: 1100,
    temperature: 0.7,
    // Let Anthropic/Gemini browse with the user's own key (no Tavily needed).
    webSearch: supportsNativeWebSearch(engine.provider),
  })

  if (!result.ok) {
    // Returned rather than stashed in a module-level variable: two requests in
    // flight at once would otherwise read each other's error.
    console.error(`[llm] ${result.error}`)
    return { ok: false, error: result.error }
  }
  return { ok: true, content: result.content, model: result.model }
}
