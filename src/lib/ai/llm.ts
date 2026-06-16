import type { TeamProfile } from "@/lib/data/teams"
import type { PlayerProfile } from "@/lib/data/players"
import { formatStat, getLeagueBadge } from "@/lib/ai/local-advisor"
import { chatComplete, type ChatMessage } from "@/lib/ai/chat"
import type { AiProvider } from "@/lib/ai/providers"
import type { Locale } from "@/lib/i18n/config"
import { aiLanguageDirective } from "@/lib/ai/language"

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
}

let lastError: string | null = null

export function lastLlmError(): string | null {
  return lastError
}

function setError(msg: string): void {
  lastError = msg
  console.error(`[llm] ${msg}`)
}

function buildPlayerContext(profile: PlayerProfile): string {
  const latest = profile.seasons[0]

  const lines: string[] = []
  lines.push(`# Player mentioned in the query`)
  lines.push(`- Name: ${profile.fullName}`)
  lines.push(`- Slug: ${profile.slug}`)
  lines.push(`- League: ${profile.league.name} (${profile.league.region})`)
  if (profile.team) {
    lines.push(`- Current team: ${profile.team.name}`)
  } else {
    lines.push(`- Current team: free agent / no team registered`)
  }
  if (profile.position) lines.push(`- Position: ${profile.position}`)
  if (profile.nationality) lines.push(`- Nationality: ${profile.nationality}`)
  if (profile.heightCm)
    lines.push(`- Height: ${(profile.heightCm / 100).toFixed(2)} m`)

  if (latest) {
    const gp = latest.gamesPlayed || 1
    lines.push("")
    lines.push(`Last recorded season (${latest.seasonName}):`)
    if (latest.gamesPlayed !== null)
      lines.push(`- Games: ${latest.gamesPlayed}`)
    if (latest.pointsTotal !== null)
      lines.push(`- Points: ${formatStat(latest.pointsTotal / gp)} PPG`)
    if (latest.reboundsTotal !== null)
      lines.push(`- Rebounds: ${formatStat(latest.reboundsTotal / gp)} RPG`)
    if (latest.assistsTotal !== null)
      lines.push(`- Assists: ${formatStat(latest.assistsTotal / gp)} APG`)
    if (latest.stealsTotal !== null)
      lines.push(`- Steals: ${formatStat(latest.stealsTotal / gp)} SPG`)
    if (latest.blocksTotal !== null)
      lines.push(`- Blocks: ${formatStat(latest.blocksTotal / gp)} BPG`)
  } else {
    lines.push("")
    lines.push(`No season stats recorded in the database.`)
  }

  lines.push("")
  lines.push(
    `IMPORTANT: this data is the only verifiable information. Do not invent other contracts, awards, or seasons. If the query requires additional information (exact salary, injuries, etc.) state it clearly.`,
  )

  return lines.join("\n")
}

function buildTeamContext(team: TeamProfile): string {
  const lines: string[] = []
  lines.push(`# User's team`)
  lines.push(`- Name: ${team.name}`)
  lines.push(`- League: ${team.league.name} (${team.league.region})`)
  lines.push(`- Roster: ${team.roster.length} players`)

  const positions = team.roster.reduce<Record<string, number>>((acc, p) => {
    const pos = (p.position || "?").toUpperCase().charAt(0)
    acc[pos] = (acc[pos] ?? 0) + 1
    return acc
  }, {})
  const posLine = Object.entries(positions)
    .map(([k, v]) => `${k}:${v}`)
    .join(" · ")
  if (posLine) lines.push(`- Position distribution: ${posLine}`)

  if (team.roster.length > 0) {
    const names = team.roster
      .slice(0, 12)
      .map((p) => `${p.fullName}${p.position ? ` (${p.position})` : ""}`)
      .join(", ")
    lines.push(
      `- Core rotation: ${names}${team.roster.length > 12 ? ` and ${team.roster.length - 12} more` : ""}`,
    )
  }
  return lines.join("\n")
}

function buildSystemPrompt(input: GenerateAdvisorInput): string {
  const leagueBadge = getLeagueBadge(input.team.league.name)
  const teamCtx = buildTeamContext(input.team)
  const playerCtx = input.playerProfile
    ? "\n\n" + buildPlayerContext(input.playerProfile)
    : ""

  return [
    `You are Basket Scout AI, an expert basketball signing advisor with deep knowledge of the NBA, EuroLeague, and Liga ACB (Spain). Your goal is to help the user make informed decisions about additions to their team.`,
    ``,
    `## Behavior rules`,
    `- ${aiLanguageDirective(input.locale)}`,
    `- Keep the tone professional but approachable.`,
    `- Base your answers on the data provided in the context. Do not invent contracts, awards, injuries, or stats that are not explicitly provided. If you don't have a piece of data, say so.`,
    `- Be concise (150-300 words). No filler. Never use phrases like "Here are...", "Each of these players...", "In conclusion...". Get straight to the point.`,
    `- If the query references a specific player, focus on their profile, fit with the team, and pros/cons.`,
    `- If the query is generic (recommend a point guard, find a scorer...), propose 2-3 reasonable alternatives.`,
    `- If the query is a follow-up ("why X?", "what about instead...?"), respond directly without repeating previous content.`,
    ``,
    `## MANDATORY response format`,
    `Always use this structure. It is strict, do not improvise:`,
    ``,
    `### For player recommendations:`,
    "",
    `## Quick summary`,
    `1 direct sentence with the main conclusion.`,
    ``,
    `## Recommended profiles`,
    ``,
    `### 1. Full Name — Position (League, Team)`,
    `- **Why they fit**: 1 concrete sentence.`,
    `- **Strengths**: 2-3 keywords separated by comma.`,
    `- **To consider**: 1 sentence on risk or condition.`,
    `- **Estimated cost**: range or label.`,
    ``,
    `(repeat ### N. block for each player, up to 3)`,
    ``,
    `## Before negotiating`,
    `- 2-3 bullets with practical considerations (salary cap, clause, timing).`,
    "",
    ``,
    `### For single player analysis:`,
    "",
    `## Profile`,
    `1-2 sentences with the player's profile and current form.`,
    ``,
    `## Stats`,
    `| Games | Min | Points | Rebounds | Assists | Steals | Blocks | FG | 3P | FT |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
    `| value | value | value | ... | ... | ... | ... | ... | ... | ... |`,
    ``,
    `## Team fit`,
    `- 2-3 bullets on pros and cons of the operation.`,
    ``,
    `## Verdict`,
    `1 final sentence with the recommendation.`,
    "",
    ``,
    `### For follow-up questions:`,
    `Respond in 2-4 sentences max, without a "Quick summary" section. Start with the direct answer.`,
    ``,
    `## Markdown formatting rules`,
    `- Headings: use ## for main sections, ### for sub-sections.`,
    `- **Bold** ONLY for player names and field labels (Why they fit, Strengths, etc.).`,
    `- Lists ALWAYS with dash and space ("- text").`,
    `- Tables ALWAYS with the first row as header separated by | and an empty separator row below.`,
    `- Emojis: max 1 at the start of each main section (🏀, 📊, 🎯, 🛡️, 💡).`,
    `- NEVER use comparison tables with more than 3 columns. For comparisons, use lists.`,
    ``,
    `## User's team context`,
    teamCtx,
    ``,
    `Keep in mind the team plays in the ${leagueBadge} and their signings must fit the system, salary cap, and locker room chemistry of that league.${playerCtx}`,
  ].join("\n")
}

export async function generateAdvisorResponse(
  input: GenerateAdvisorInput,
  engine: AdvisorEngine,
): Promise<{ content: string; model: string } | null> {
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
    maxTokens: 700,
    temperature: 0.6,
  })

  if (!result.ok) {
    setError(result.error)
    return null
  }
  lastError = null
  return { content: result.content, model: result.model }
}
