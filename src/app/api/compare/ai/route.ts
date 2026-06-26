import { NextResponse } from "next/server"
import { getPlayerForCompare } from "@/lib/data/compare"
import {
  comparePlayers,
  type ComparisonOutput,
} from "@/lib/ai/player-comparator"
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
const MAX_NAME_LEN = 120

type Body = {
  aSlug?: string
  bSlug?: string
  aName?: string
  bName?: string
}

function buildComparePrompt(
  aName: string,
  bName: string,
  r: ComparisonOutput,
  locale: Locale,
): string {
  const cats = r.categories
    .map((c) => {
      const winner =
        c.winner === "a" ? aName : c.winner === "b" ? bName : "tie"
      return `- ${c.label}: ${aName} ${c.formatted.a} vs ${bName} ${c.formatted.b} → ${winner}`
    })
    .join("\n")
  return [
    `Players: ${aName} vs ${bName}`,
    `Overall AI score: ${aName} ${r.overall.aScore.toFixed(1)} — ${bName} ${r.overall.bScore.toFixed(1)} (confidence ${r.overall.confidence})`,
    `Archetypes: ${aName} = ${r.archetype.a}; ${bName} = ${r.archetype.b}`,
    `Category winners:`,
    cats,
    "",
    aiLanguageDirective(locale),
    "",
    `Write a sharp 3-4 sentence verdict: who is the better fit and for what kind of team and role, with the decisive reason backed by the numbers above. Add the one situation where the other player is the better pick. Commit to a call — no hedging, no generic praise. Plain prose, no lists, no markdown.`,
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
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    )
  }

  const aSlug = body.aSlug?.trim()
  const bSlug = body.bSlug?.trim()
  if (!aSlug || !bSlug) {
    return NextResponse.json(
      { error: "Missing player slugs." },
      { status: 400 },
    )
  }
  if (aSlug.length > MAX_SLUG_LEN || bSlug.length > MAX_SLUG_LEN) {
    return NextResponse.json(
      { error: "Slug too long." },
      { status: 400 },
    )
  }
  if (aSlug === bSlug) {
    return NextResponse.json(
      { error: "Pick two different players." },
      { status: 400 },
    )
  }

  const [a, b] = await Promise.all([
    getPlayerForCompare(aSlug),
    getPlayerForCompare(bSlug),
  ])

  if (!a) {
    return NextResponse.json(
      { error: `Player "${aSlug}" not found.` },
      { status: 404 },
    )
  }
  if (!b) {
    return NextResponse.json(
      { error: `Player "${bSlug}" not found.` },
      { status: 404 },
    )
  }

  const aName = (body.aName?.trim() || aSlug).slice(0, MAX_NAME_LEN)
  const bName = (body.bName?.trim() || bSlug).slice(0, MAX_NAME_LEN)

  const locale = await getLocale()

  try {
    const result = comparePlayers(a, b, locale)

    // Optional AI take, powered by whatever engine the user picked for Compare.
    // The deterministic breakdown above always renders; this just adds prose.
    let aiSummary: string | null = null
    let aiProvider: string | null = null
    let aiConfigured = false
    let aiReason: string | null = null

    const user = await getCurrentUser(request.headers.get("cookie"))
    const engine = user
      ? await resolveEngine(user.id, "compare")
      : await resolveDefaultEngine()
    if (engine.ok) {
      aiConfigured = true
      const llm = await chatComplete({
        provider: engine.provider,
        model: engine.model,
        apiKey: engine.apiKey,
        system: `You are an elite basketball scout. Given a structured head-to-head, write a short, specific and decisive verdict anchored to the data. No hedging, no generic filler, no markdown, no lists — plain prose. ${aiLanguageDirective(locale)}`,
        messages: [
          {
            role: "user",
            content: buildComparePrompt(aName, bName, result, locale),
          },
        ],
        maxTokens: 320,
        temperature: 0.6,
      })
      if (llm.ok) {
        aiSummary = cleanLlmOutput(llm.content)
        aiProvider = engine.provider.id
      } else {
        aiReason = "ai_error"
      }
    } else {
      aiReason = engine.reason
    }

    return NextResponse.json({
      data: result,
      aiSummary,
      aiProvider,
      aiConfigured,
      aiReason,
    })
  } catch (error) {
    console.error("compare/ai error:", error)
    return NextResponse.json(
      { error: "Could not generate the analysis." },
      { status: 500 },
    )
  }
}
