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

/**
 * Section labels for the data block.
 *
 * Deliberately NOT markdown headings. A model shown a document made of "## "
 * titles writes one back — a playbook answer came out as "Frame 1 — 2-player
 * Pick & Roll / Frame 2 — 3-player Pick & Roll", the frame headings copied
 * across with the coach's actual question never answered. The same reasoning
 * as the trade route's data block, applied here.
 */
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
    "PLAYER —",
    `Name: ${name}`,
    `League: ${league}`,
    `Team: ${team ?? "Free agent"}`,
    `Position: ${position ?? "N/A"}`,
    `Season: ${season.seasonName} · ${season.gamesPlayed} GP`,
    "",
    "PER-GAME STATS —",
    `Points: ${ppg} · Rebounds: ${rpg} · Assists: ${apg} · Steals: ${spg} · Blocks: ${bpg}`,
    "",
    "SHOOTING —",
    `FG: ${fmtPct(season.fgPct)} · 3P: ${fmtPct(season.threePct)} · FT: ${fmtPct(season.ftPct)}`,
    "",
    "ADVANCED METRICS —",
    advancedStr,
    "",
    "MARKET VALUATION —",
    valStr,
    leagueContext ? "" : null,
    leagueContext,
    shotChartStr ? "" : null,
    shotChartStr,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

/**
 * The brief for a scouting note, in the reader's language.
 *
 * Split out of `buildPlayerPrompt` because everything below used to be
 * appended to the DATA and sent in the user turn. A small model reads the user
 * turn as material rather than as orders and answers it — the compare screen
 * shipped a translated paraphrase of its own brief to a user for exactly this
 * reason. Instructions go in `system`; the user turn carries the numbers.
 */
export function playerReportSystem(
  locale: Locale,
  opts: { hasShotChart: boolean; canBrowse: boolean },
): string {
  const copy = promptCopy(locale)
  const labels = REPORT_LABELS[locale] ?? REPORT_LABELS.en
  const es = locale === "es"
  return [
    es
      ? "Eres un ojeador de baloncesto con experiencia y le escribes una nota corta a un entrenador que no ha visto nunca a este jugador."
      : "You are an experienced basketball scout writing a short note for a coach who has never seen this player.",
    es
      ? "Te van a pasar sus datos. Mójate y sé concreto: ata cada afirmación a los números que tienes, y no llames a nadie \"sólido\" o \"versátil\" sin decir qué lo hace serlo."
      : "You will be given his numbers. Be specific and commit to an opinion: anchor every claim to the numbers you have, and never call someone 'solid' or 'versatile' without saying what makes them so.",
    es
      ? "Habla solo de lo que te han dado. No te inventes contratos, lesiones, premios ni porcentajes de tiro."
      : "Only discuss what you were given. Do not invent contracts, injuries, awards or shooting splits.",
    "",
    es
      ? "Una nota que un entrenador pueda leer en menos de un minuto. Cubre, en este orden, y SOLO donde tengas algo concreto que decir:"
      : "A note a coach could read in under a minute. Cover, in this order, and ONLY where you have something concrete to say:",
    es
      ? `- ${labels.onCourt} — qué le da de verdad a un equipo, a partir de sus números. Donde tengas la comparación con la liga, júzgalo contra ella en vez de soltar el dato en bruto.`
      : `- ${labels.onCourt} — what he actually gives a team, from his numbers. Where you have the league comparison, judge him against it rather than quoting the raw figure.`,
    es
      ? `- ${labels.weakness} — dónde te cuesta caro. Esta no te la saltes nunca: una nota sin debilidades no sirve de nada.`
      : `- ${labels.weakness} — where he costs you. Never skip this one; a note with no weaknesses is useless.`,
    es
      ? `- ${labels.value} — ¿es justo el precio estimado para esa producción?`
      : `- ${labels.value} — is the estimated price fair for that production?`,
    opts.hasShotChart
      ? es
        ? `- ${labels.shooting} — la conclusión que sacas de las zonas: desde dónde hace daño de verdad y desde dónde no. Como mucho dos porcentajes, y solo si sostienen esa conclusión. No enumeres las zonas una por una — el entrenador ya tiene ese gráfico delante.`
        : `- ${labels.shooting} — the conclusion you draw from the zones: where he really hurts you and where he does not. Two percentages at most, and only if they carry that conclusion. Do not list the zones one by one — the coach already has that chart in front of him.`
      : null,
    opts.canBrowse
      ? es
        ? `- ${labels.reputation} — qué dicen la prensa y la afición de él, y cualquier cosa de fuera de la pista que importe. Cita las fuentes como [nombre](url).`
        : `- ${labels.reputation} — what press and fans say about him, and anything off-court that matters. Cite sources as [name](url).`
      : null,
    "",
    es
      ? `Formato: un párrafo corto por punto, cada uno abriendo con la etiqueta en negrita y un punto, así: "**${labels.onCourt}.** Es…". Sin viñetas, sin titulares y sin tablas.`
      : `Format: one short paragraph per point, each opening with the label in bold followed by a full stop, like "**${labels.onCourt}.** He is…". No bullet lists, no headings, no tables.`,
    es
      ? "De dos a cuatro frases por punto. Cierra con un veredicto tuyo de una línea, no con un resumen de lo anterior."
      : "Two to four sentences per point. Finish with a one-line verdict of your own, not a summary of the above.",
    es
      ? "Si te falta un punto, déjalo fuera en vez de escribir que no tienes el dato — nunca le cuentes al lector lo que no has podido hacer."
      : "Leave a point out entirely rather than writing that you lack the data for it — never tell the reader what you could not do.",
    "",
    copy.plainLanguage.join("\n"),
    "",
    aiLanguageDirective(locale),
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
  return ["SHOOTING BY ZONE (real shot-location data) —", ...lines].join(
    "\n",
  )
}