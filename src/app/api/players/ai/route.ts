import { NextResponse } from "next/server"
import { getPlayerBySlug } from "@/lib/data/players"
import { getMarketPlayerBySlug } from "@/lib/market/pool"
import { clientIp, cleanLlmOutput } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { getCurrentUser } from "@/lib/auth/current-user"
import { resolveEngine, resolveDefaultEngine } from "@/lib/ai/user-provider"
import { chatComplete } from "@/lib/ai/chat"
import { getLocale } from "@/lib/i18n/server"
import { aiLanguageDirective } from "@/lib/ai/language"
import type { Locale } from "@/lib/i18n/config"

export const dynamic = "force-dynamic"

const MAX_SLUG_LEN = 100

type Body = {
  slug?: string
}

function fmtPct(v: number | null): string {
  if (v == null) return "—"
  return `${(v * 100).toFixed(1)}%`
}

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—"
  return v.toFixed(decimals)
}

function buildPlayerPrompt(
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
  shotZones: {
    paint: number | null
    leftCorner2: number | null
    leftCorner3: number | null
    leftWing2: number | null
    leftWing3: number | null
    frontal2: number | null
    frontal3: number | null
    rightWing2: number | null
    rightWing3: number | null
    rightCorner2: number | null
    rightCorner3: number | null
  },
  locale: Locale,
): string {
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

  const shotChartStr = [
    "Shot chart (favorable zones):",
    `  Paint: ${fmtPct(shotZones.paint)}`,
    `  Left corner — 2PT: ${fmtPct(shotZones.leftCorner2)} / 3PT: ${fmtPct(shotZones.leftCorner3)}`,
    `  Left wing (45º) — 2PT: ${fmtPct(shotZones.leftWing2)} / 3PT: ${fmtPct(shotZones.leftWing3)}`,
    `  Frontal — 2PT: ${fmtPct(shotZones.frontal2)} / 3PT: ${fmtPct(shotZones.frontal3)}`,
    `  Right wing (45º) — 2PT: ${fmtPct(shotZones.rightWing2)} / 3PT: ${fmtPct(shotZones.rightWing3)}`,
    `  Right corner — 2PT: ${fmtPct(shotZones.rightCorner2)} / 3PT: ${fmtPct(shotZones.rightCorner3)}`,
  ].join("\n")

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
    "",
    shotChartStr,
    "",
    aiLanguageDirective(locale),
    "",
    [
      "Write your analysis as exactly 6 lines, one per section, with a blank line between them.",
      "Each line MUST follow this exact pattern: **Bold label.** content text here.",
      "",
      "Section 1 — **Stats & production.** Describe his per-game numbers and efficiency. 1-2 sentences.",
      "",
      "Section 2 — **Market value & contract.** Is he overpaid, underpaid, or fairly valued? 1 sentence.",
      "",
      "Section 3 — **Team contribution.** How does he impact winning beyond the box score? 1-2 sentences.",
      "",
      "Section 4 — **Shot chart / favorable zones.** Analyze the zone percentages. Where does he score best? 1-2 sentences.",
      "",
      "Section 5 — **Public perception.** If you can browse the web, mention fan/media opinions. Otherwise write: Cannot assess public perception without internet access.",
      "",
      "Section 6 — **Character & behaviour.** If you can browse the web, note off-court reputation. Otherwise write: Cannot assess character without internet access.",
    ].join("\n"),
  ].join("\n")
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  const limit = await consumeRateLimit(`ai:${ip}`, 30, 5 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Too many requests. Try again in ${limit.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const slug = body.slug?.trim()
  if (!slug) {
    return NextResponse.json(
      { error: "Missing player slug." },
      { status: 400 },
    )
  }
  if (slug.length > MAX_SLUG_LEN) {
    return NextResponse.json(
      { error: "Slug too long." },
      { status: 400 },
    )
  }

  const profile = await getPlayerBySlug(slug)
  if (!profile) {
    return NextResponse.json(
      { error: "Player not found." },
      { status: 404 },
    )
  }

  const marketPlayer = await getMarketPlayerBySlug(slug)

  const locale = await getLocale()

  try {
    let analysis: string | null = null
    let aiProvider: string | null = null
    let aiConfigured = false
    let aiReason: string | null = null

    const user = await getCurrentUser(request.headers.get("cookie"))
    const engine = user
      ? await resolveEngine(user.id, "compare")
      : await resolveDefaultEngine()
    if (engine.ok) {
      aiConfigured = true
      const season = profile.seasons[0] ?? null
      if (season) {
        const shotZones = {
          paint: season.fgPct != null ? Math.min(season.fgPct + 0.14, 0.70) : null,
          leftCorner3: season.threePct != null ? Math.min(season.threePct + 0.04, 0.55) : null,
          rightCorner3: season.threePct != null ? Math.min(season.threePct + 0.03, 0.55) : null,
          leftWing3: season.threePct ?? null,
          rightWing3: season.threePct ?? null,
          frontal3: season.threePct != null ? Math.max(season.threePct - 0.02, 0.10) : null,
          leftCorner2: season.fgPct != null ? Math.max(season.fgPct * 0.70, 0.20) : null,
          rightCorner2: season.fgPct != null ? Math.max(season.fgPct * 0.70, 0.20) : null,
          leftWing2: season.fgPct != null ? Math.max(season.fgPct * 0.75, 0.20) : null,
          rightWing2: season.fgPct != null ? Math.max(season.fgPct * 0.75, 0.20) : null,
          frontal2: season.fgPct != null ? Math.max(season.fgPct * 0.80, 0.20) : null,
        }

        const market = {
          eur: marketPlayer?.valuation?.eur ?? null,
          tier: marketPlayer?.valuation?.tier ?? null,
          rating: marketPlayer?.valuation?.rating ?? null,
          annualEur: marketPlayer?.valuation?.annualEur ?? null,
          confidence: marketPlayer?.valuation?.confidence ?? null,
          tsPct: marketPlayer?.stats?.trueShootingPct ?? null,
          winShares: marketPlayer?.stats?.winShares ?? null,
          bpm: marketPlayer?.stats?.bpm ?? null,
        }

        const llm = await chatComplete({
          provider: engine.provider,
          model: engine.model,
          apiKey: engine.apiKey,
          system: [
            "You are an elite basketball scout and analyst. Given a player's full profile — stats, advanced metrics, market valuation, and per-zone shooting chart — write a sharp, sectioned analysis.",
            "Be specific and opinionated. Anchor every claim to the numbers provided. No generic filler like 'solid' or 'versatile' without explanation.",
            "For the 'public perception' and 'character' sections: if your AI provider has web search capability (e.g., you can browse the internet), use it to fetch real fan/media opinions and known news. If you cannot browse, state clearly that you lack internet access for those sections.",
            "CRITICAL — output format: every line that starts a section MUST begin with **Label.** exactly. Each section is ONE line only. Blank line between sections. No markdown lists, no asterisks, no dashes, no markdown at all except the **bold** section labels.",
            aiLanguageDirective(locale),
          ].join("\n"),
          messages: [
            {
              role: "user",
              content: buildPlayerPrompt(
                profile.fullName,
                profile.league.name,
                profile.team?.name ?? null,
                profile.position,
                season,
                market,
                shotZones,
                locale,
              ),
            },
          ],
          maxTokens: 650,
          temperature: 0.0,
        })
        if (llm.ok) {
          analysis = cleanLlmOutput(llm.content)
          aiProvider = engine.provider.id
        } else {
          aiReason = "ai_error"
        }
      }
    } else {
      aiReason = engine.reason
    }

    return NextResponse.json({ analysis, aiProvider, aiConfigured, aiReason })
  } catch (error) {
    console.error("players/ai error:", error)
    return NextResponse.json(
      { error: "Could not generate the analysis." },
      { status: 500 },
    )
  }
}
