/**
 * Builds the scouting note prompt for a single player.
 *
 * Lives here rather than in the route because a Next.js route file may only
 * export HTTP handlers and route config — exporting the builder for tests from
 * there fails the typed-routes check.
 */
import type { Locale } from "@/lib/i18n/config"
import type { ShotZonesJson, ShotZoneKey } from "@/lib/db/schema"
import { aiLanguageDirective } from "@/lib/ai/language"
import { promptCopy } from "@/lib/ai/prompt-copy"

function fmtPct(v: number | null): string {
  if (v == null) return "—"
  return `${(v * 100).toFixed(1)}%`
}

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—"
  return v.toFixed(decimals)
}

/**
 * Section labels for the scouting note, in the reader's language. Kept here
 * rather than in the shared prompt copy because they are specific to this one
 * report shape.
 */
const REPORT_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    onCourt: "On the court",
    weakness: "Where he falls short",
    value: "What he is worth",
    shooting: "Where he scores from",
    reputation: "Reputation",
  },
  es: {
    onCourt: "En la pista",
    weakness: "Dónde flojea",
    value: "Cuánto vale",
    shooting: "De dónde anota",
    reputation: "Cómo se le ve",
  },
}

export function buildPlayerPrompt(
  name: string,
  league: string,
  team: string | null,
  position: string | null,
  season: {
    seasonName: string
    gamesPlayed: number
    pointsTotal: number | null
    reboundsTotal: number | null
    assistsTotal: number | null
    stealsTotal: number | null
    blocksTotal: number | null
    fgPct: number | null
    threePct: number | null
    ftPct: number | null
    per: number | null
  },
  market: {
    eur: number | null
    tier: string | null
    rating: number | null
    annualEur: number | null
    confidence: string | null
    tsPct: number | null
    winShares: number | null
    bpm: number | null
  },
  shotZones: ShotZonesJson | null,
  locale: Locale,
  canBrowse: boolean,
  /**
   * League comparison block from `describeLeagueContext`. Empty when we have
   * too little of the league measured to rank anybody honestly.
   */
  leagueContext = "",
): string {
  const copy = promptCopy(locale)
  const labels = REPORT_LABELS[locale] ?? REPORT_LABELS.en

  const ppg = season.pointsTotal != null && season.gamesPlayed > 0 ? (season.pointsTotal / season.gamesPlayed).toFixed(1) : "N/A"
  const rpg = season.reboundsTotal != null && season.gamesPlayed > 0 ? (season.reboundsTotal / season.gamesPlayed).toFixed(1) : "N/A"
  const apg = season.assistsTotal != null && season.gamesPlayed > 0 ? (season.assistsTotal / season.gamesPlayed).toFixed(1) : "N/A"
  const spg = season.stealsTotal != null && season.gamesPlayed > 0 ? (season.stealsTotal / season.gamesPlayed).toFixed(1) : "N/A"
  const bpg = season.blocksTotal != null && season.gamesPlayed > 0 ? (season.blocksTotal / season.gamesPlayed).toFixed(1) : "N/A"

  const valStr = market.eur != null
    ? `€${(market.eur / 1e6).toFixed(1)}M (${market.tier ?? "—"} tier, rating ${market.rating ?? "—"}/100, confidence ${market.confidence ?? "—"})${market.annualEur != null ? ` · annual salary: €${(market.annualEur / 1e3).toFixed(0)}K` : ""}`
    : "No market valuation available"

  const advancedStr = [
    `PER: ${fmt(season.per)}`,
    market.tsPct != null ? `TS%: ${(market.tsPct * 100).toFixed(1)}%` : null,
    market.winShares != null ? `WS: ${fmt(market.winShares, 2)}` : null,
    market.bpm != null ? `BPM: ${fmt(market.bpm, 1)}` : null,
  ].filter(Boolean).join(" · ")

  const shotChartStr = describeShotZones(shotZones)

  return [
    "## Player profile",
    `Name: ${name}`,
    `League: ${league}`,
    `Team: ${team ?? "Free agent"}`,
    `Position: ${position ?? "N/A"}`,
    `Season: ${season.seasonName} · ${season.gamesPlayed} GP`,
    "",
    "## Per-game stats",
    `Points: ${ppg} · Rebounds: ${rpg} · Assists: ${apg} · Steals: ${spg} · Blocks: ${bpg}`,
    "",
    "## Shooting",
    `FG: ${fmtPct(season.fgPct)} · 3P: ${fmtPct(season.threePct)} · FT: ${fmtPct(season.ftPct)}`,
    "",
    "## Advanced metrics",
    advancedStr,
    "",
    "## Market valuation",
    valStr,
    leagueContext ? "" : null,
    leagueContext,
    shotChartStr ? "" : null,
    shotChartStr,
    "",
    aiLanguageDirective(locale),
    "",
    copy.plainLanguage.join("\n"),
    "",
    [
      "Write a short scouting note a coach could read in under a minute.",
      "",
      "Cover, in this order, and ONLY where you have something concrete to say:",
      `- ${labels.onCourt} — what he actually gives a team, from his numbers. Where you have the league comparison, judge him against it rather than quoting the raw figure.`,
      `- ${labels.weakness} — where he costs you. Never skip this one; a note with no weaknesses is useless.`,
      `- ${labels.value} — is the estimated price fair for that production?`,
      shotChartStr
        ? `- ${labels.shooting} — where on the floor he scores from, based on the zone data above.`
        : null,
      canBrowse
        ? `- ${labels.reputation} — what press and fans say about him, and anything off-court that matters. Cite sources as [name](url).`
        : null,
      "",
      "Format: one short paragraph per point, each opening with the label in bold followed by a full stop, like \"**" + labels.onCourt + ".** He is…\". No bullet lists, no headings, no tables.",
      "Two to four sentences per point. Finish with a one-line verdict of your own, not a summary of the above.",
      "Leave a point out entirely rather than writing that you lack the data for it — never tell the reader what you could not do.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

/**
 * Turn the real per-zone made/attempted counts into a prompt block.
 *
 * Returns "" when there is no usable data — ACB and FEB publish no shot
 * locations at all, and a handful of attempts from one corner says nothing.
 * The section is then dropped from the report rather than filled with a
 * disclaimer. (This block used to be SYNTHESISED from the player's overall
 * FG%/3P%, so the model was describing invented zone percentages as fact.)
 */
function describeShotZones(zones: ShotZonesJson | null): string {
  if (!zones) return ""
  const LABELS: Record<ShotZoneKey, string> = {
    paint: "Paint",
    leftCorner2: "Left corner (2PT)",
    rightCorner2: "Right corner (2PT)",
    leftWing2: "Left wing (2PT)",
    rightWing2: "Right wing (2PT)",
    frontal2: "Top of the key (2PT)",
    leftCorner3: "Left corner (3PT)",
    rightCorner3: "Right corner (3PT)",
    leftWing3: "Left wing (3PT)",
    rightWing3: "Right wing (3PT)",
    frontal3: "Top of the key (3PT)",
  }
  const MIN_ATTEMPTS = 10
  const lines: string[] = []
  for (const [key, label] of Object.entries(LABELS) as Array<
    [ShotZoneKey, string]
  >) {
    const z = zones[key]
    if (!z || z.a < MIN_ATTEMPTS) continue
    lines.push(`  ${label}: ${fmtPct(z.m / z.a)} (${z.m}/${z.a})`)
  }
  if (lines.length === 0) return ""
  return ["## Shooting by zone (real, from shot-location data)", ...lines].join(
    "\n",
  )
}