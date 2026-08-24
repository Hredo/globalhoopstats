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
import { buildPlayerPrompt } from "@/lib/ai/player-report"
import {
  describeLeagueContext,
  playerLeagueContext,
} from "@/lib/market/player-context"
import {
  trimDegeneratedOutput,
  isUsableAnswer,
  isMostlyHeadings,
} from "@/lib/ai/degeneration"
import { supportsNativeWebSearch } from "@/lib/ai/chat"
import type { ShotZonesJson, ShotZoneKey } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"

export const dynamic = "force-dynamic"

const MAX_SLUG_LEN = 100

type Body = {
  slug?: string
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
      // Only ask for reputation/off-court colour when the engine can actually
      // look it up. Otherwise the report used to spend two of its six lines
      // apologising for not having internet access.
      const canBrowse = supportsNativeWebSearch(engine.provider)
      const season = profile.seasons[0] ?? null
      if (season) {
        // Real shot-location data only. These used to be derived from the
        // player's overall FG%/3P%, so the model described invented per-zone
        // percentages as fact; leagues that publish none (ACB, FEB) now simply
        // get no shooting section.
        const shotZones = season.shotZones ?? null

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

        // "26.6 puntos" means nothing on its own. Rank him inside his own
        // league so the note can say whether that is a lot HERE.
        let leagueContext = ""
        if (marketPlayer) {
          try {
            leagueContext = describeLeagueContext(
              await playerLeagueContext(marketPlayer),
              locale,
            )
          } catch {
            leagueContext = ""
          }
        }

        const llm = await chatComplete({
          provider: engine.provider,
          model: engine.model,
          apiKey: engine.apiKey,
          system: [
            "You are an experienced basketball scout writing a short note for a coach who has never seen this player.",
            "Be specific and commit to an opinion. Anchor every claim to the numbers you were given, and never call someone 'solid' or 'versatile' without saying what makes them so.",
            "Only discuss what you were actually given. Do not invent contracts, injuries, awards or shooting splits.",
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
                canBrowse,
                leagueContext,
              ),
            },
          ],
          maxTokens: 650,
          // 0 made every note read identically; a little slack buys natural
          // sentences without loosening the grounding rules above.
          temperature: 0.35,
          webSearch: canBrowse,
        })
        if (llm.ok) {
          // Cut a repetition loop before it reaches the page; if barely
          // anything survives, show no note rather than a broken one.
          const guard = trimDegeneratedOutput(llm.content)
          const broken =
            isMostlyHeadings(guard.text) ||
            (guard.looped && !isUsableAnswer(guard.text))
          if (!broken) {
            analysis = cleanLlmOutput(guard.text)
            aiProvider = engine.provider.id
          } else {
            aiReason = "ai_error"
          }
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
