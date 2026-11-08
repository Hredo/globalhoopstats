/**
 * /llms.txt and /llms-full.txt (https://llmstxt.org): a plain-Markdown map of
 * the site for language models and agents — what the site covers, where each
 * league's numbers live, how fresh they are and how to cite them. The pages are
 * built for people; this is the same catalogue written for a reader that wants
 * the facts and the links without the layout.
 *
 * Pure functions over data the routes load, so the tests need no database.
 */
import { upstreamFor } from "@/lib/sources/types"
import { SITE } from "@/lib/site"

/**
 * The name people search for is often not the one we display: the ACB shows
 * under its sponsor name (Liga Endesa), and FEB renamed its leagues in 2025
 * while everyone still searches "LEB Oro". `former` names are called
 * "formerly"; the others are plain aliases.
 */
export const LEAGUE_ALIASES: Record<string, { name: string; former: boolean }> =
  {
    acb: { name: "Liga ACB", former: false },
    "leb-oro": { name: "LEB Oro", former: true },
    "leb-plata": { name: "LEB Plata", former: true },
    eba: { name: "Liga EBA", former: true },
  }

export type LlmsLeague = {
  slug: string
  name: string
  seasonLabel: string | null
  teamCount: number
  playerCount: number
  lastSync: Date | null
}

export type LlmsScorer = {
  fullName: string
  slug: string
  teamName: string | null
  ppg: number
}

/** Order of the leagues in the file: top flight first, then down the pyramid. */
const ORDER = ["nba", "euroleague", "acb", "leb-oro", "leb-plata", "eba"]

function sortLeagues(leagues: LlmsLeague[]): LlmsLeague[] {
  const rank = (slug: string) => {
    const i = ORDER.indexOf(slug)
    return i === -1 ? ORDER.length : i
  }
  return [...leagues].sort((a, b) => rank(a.slug) - rank(b.slug))
}

const day = (d: Date) => d.toISOString().slice(0, 10)

/** Names are scraped: keep a stray `|` or `]` from breaking a table or a link. */
const md = (s: string) =>
  s.replace(/[\\|[\]]/g, (c) => `\\${c}`).replace(/\s+/g, " ")

/** "Liga Endesa (Liga ACB)" / "Primera FEB (formerly LEB Oro)". */
export function leagueDisplayName(slug: string, name: string): string {
  const aka = LEAGUE_ALIASES[slug]
  if (!aka) return name
  return aka.former ? `${name} (formerly ${aka.name})` : `${name} (${aka.name})`
}

function leagueLine(l: LlmsLeague): string {
  const parts = [
    `${l.teamCount} teams, ${l.playerCount} players`,
    l.seasonLabel ? `season ${l.seasonLabel}` : null,
    upstreamFor(l.slug) ? `source: ${upstreamFor(l.slug)!.name}` : null,
    l.lastSync ? `updated ${day(l.lastSync)}` : null,
  ].filter(Boolean)
  return `- [${md(leagueDisplayName(l.slug, l.name))}](${SITE.url}/leagues/${encodeURIComponent(l.slug)}): ${parts.join("; ")}`
}

function header(leagues: LlmsLeague[], generatedAt: Date): string[] {
  const players = leagues.reduce((n, l) => n + l.playerCount, 0)
  const teams = leagues.reduce((n, l) => n + l.teamCount, 0)
  const latest = leagues
    .map((l) => l.lastSync)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  return [
    `# ${SITE.name}`,
    "",
    "> Cross-league basketball statistics for the NBA, EuroLeague, Liga ACB (Liga Endesa) and " +
      "Spain's FEB pyramid (Primera FEB, Segunda FEB, Tercera FEB — formerly LEB Oro, LEB Plata " +
      "and Liga EBA), normalised into one format with one profile per player across every league " +
      "they have played in. Bilingual (Spanish/English); based in Spain.",
    "",
    `Coverage right now: ${leagues.length} leagues, ${teams} team-seasons and ${players} player-seasons` +
      (latest ? `; data last refreshed ${day(latest)}` : "") +
      ". The NBA, EuroLeague and ACB are re-synced daily and the FEB leagues weekly, from each " +
      "league's publisher, and every sync passes a quality gate before it replaces what is published.",
    "",
    "For many FEB (Primera/Segunda/Tercera FEB) players this is the only place on the web with " +
      "their season averages, per-40 rates and advanced metrics in one page.",
    "",
    `This file was generated ${day(generatedAt)}.`,
  ]
}

const CITE = [
  "## How to cite",
  "",
  `- Credit the compilation and the original publisher: "Source: ${SITE.name} (${SITE.url.replace(/^https?:\/\//, "")}), compiled from <publisher>", with the page URL and the "updated" date.`,
  "- Each player page states the season, games played and per-game averages in one sentence, with its source and date, written to be quoted as-is.",
  "- Per-game = season total / games played. Per 40 = rate per 40 minutes played. TS% (true shooting) = PTS / (2 × (FGA + 0.44 × FTA)). PER = player efficiency rating.",
  `- Full definitions and how leagues are made comparable: [Methodology](${SITE.url}/methodology).`,
]

function sections(leagues: LlmsLeague[]): string[] {
  const u = SITE.url
  return [
    "## Leagues",
    "",
    ...sortLeagues(leagues).map(leagueLine),
    "",
    "## Directories",
    "",
    `- [Players](${u}/players): every player, filterable by league and season (?league=acb&season=2026-27); search with ?q=name`,
    `- [Teams](${u}/teams): every club with its roster and coaching staff`,
    `- [Coaches](${u}/coaches): head coaches and assistants by club`,
    `- [Leagues](${u}/leagues): one landing page per league with its scoring leaders`,
    `- [Compare](${u}/compare): two players side by side, across leagues`,
    `- [Projection](${u}/projection): how a player's numbers would translate one level up`,
    "",
    "## URL patterns",
    "",
    `- Player: ${u}/players/{slug} — bio, per-season lines in each league, shooting splits, league percentiles`,
    `- Team: ${u}/teams/{league}/{slug} — roster with per-game stats and staff`,
    `- League: ${u}/leagues/{league} — league slugs: ${ORDER.join(", ")}`,
    "",
    ...CITE,
    "",
    "## Data and API",
    "",
    `- [OpenAPI description](${u}/openapi.json): the public read API /api/v1 (leagues, teams, players, one player's career) — JSON, API key required`,
    `- [Developer guide](${u}/developers): authentication, quotas, attribution`,
    `- [Methodology](${u}/methodology): sources, normalisation, metric definitions`,
    `- [Sitemap](${u}/sitemap.xml): every public player, team and league URL`,
    "",
    "## Optional",
    "",
    `- [llms-full.txt](${u}/llms-full.txt): this file plus each league's current scoring leaders`,
    `- [Terms](${u}/terms) · [Privacy](${u}/privacy) · [Contact](${u}/contact)`,
  ]
}

export function buildLlmsTxt(
  leagues: LlmsLeague[],
  generatedAt = new Date(),
): string {
  return [...header(leagues, generatedAt), "", ...sections(leagues), ""].join(
    "\n",
  )
}

export function buildLlmsFullTxt(
  leagues: LlmsLeague[],
  scorers: Map<string, LlmsScorer[]>,
  generatedAt = new Date(),
): string {
  const leaders = sortLeagues(leagues).flatMap((l) => {
    const rows = scorers.get(l.slug) ?? []
    if (rows.length === 0) return []
    const upstream = upstreamFor(l.slug)
    return [
      `### ${leagueDisplayName(l.slug, l.name)}${l.seasonLabel ? ` — ${l.seasonLabel}` : ""}`,
      "",
      [
        "Points per game, minimum 5 games played",
        upstream ? `source: ${upstream.name}` : null,
        l.lastSync ? `updated ${day(l.lastSync)}` : null,
      ]
        .filter(Boolean)
        .join("; ") + ".",
      "",
      "| # | Player | Team | PPG |",
      "| --- | --- | --- | --- |",
      ...rows.map(
        (s, i) =>
          `| ${i + 1} | [${md(s.fullName)}](${SITE.url}/players/${encodeURIComponent(s.slug)}) | ${md(s.teamName ?? "—")} | ${s.ppg.toFixed(1)} |`,
      ),
      "",
    ]
  })
  return [
    ...header(leagues, generatedAt),
    "",
    ...sections(leagues),
    "",
    "## Scoring leaders by league",
    "",
    ...leaders,
  ].join("\n")
}
