import { NextResponse } from "next/server"
import { getPlayerForCompare } from "@/lib/data/compare"
import {
  comparePlayers,
  type ComparisonOutput,
} from "@/lib/ai/player-comparator"
import {
  aiOwnerKeyGuard,
  audit,
  clientIp,
  sanitisePromptInput,
} from "@/lib/security/ai-advisor"
import { getCurrentUser } from "@/lib/auth/current-user"
import { resolveEngine, resolveDefaultEngine } from "@/lib/ai/user-provider"
import { generateGroundedAnswer } from "@/lib/ai/answer"
import { supportsNativeWebSearch } from "@/lib/ai/chat"
import { getLocale } from "@/lib/i18n/server"
import { aiLanguageDirective } from "@/lib/ai/language"
import { houseStyle } from "@/lib/ai/prompt-copy"
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

/**
 * The DATA only — no instructions.
 *
 * Everything below used to live here, in the user message: the language
 * directive, the whole house style, and the "write 3-4 sentences…" brief. A
 * small model does not read the user turn as orders, it reads it as material,
 * so it did the obvious thing and paraphrased the brief back as the answer —
 * translated into Spanish, headings and all ("Prose sencillo solo: no listas,
 * no encabezados…"). Instructions belong in the system prompt; the user turn
 * carries the numbers and nothing else.
 */
function buildCompareData(
  aName: string,
  bName: string,
  r: ComparisonOutput,
  locale: Locale,
): string {
  const es = locale === "es"
  const tie = es ? "empate" : "tie"
  const cats = r.categories
    .map((c) => {
      const winner = c.winner === "a" ? aName : c.winner === "b" ? bName : tie
      return `- ${c.label}: ${aName} ${c.formatted.a} vs ${bName} ${c.formatted.b} -> ${winner}`
    })
    .join("\n")
  return [
    es ? `Jugadores: ${aName} vs ${bName}` : `Players: ${aName} vs ${bName}`,
    es
      ? `Nuestra puntuación global (estimación interna sobre 100, no un rating oficial): ${aName} ${r.overall.aScore.toFixed(1)} — ${bName} ${r.overall.bScore.toFixed(1)} (confianza: ${r.overall.confidence})`
      : `Our overall score (an internal estimate out of 100, not an official rating): ${aName} ${r.overall.aScore.toFixed(1)} — ${bName} ${r.overall.bScore.toFixed(1)} (confidence: ${r.overall.confidence})`,
    es
      ? `Perfiles: ${aName} = ${r.archetype.a}; ${bName} = ${r.archetype.b}`
      : `Player types: ${aName} = ${r.archetype.a}; ${bName} = ${r.archetype.b}`,
    es ? `Quién gana cada apartado:` : `Category winners:`,
    cats,
  ].join("\n")
}

/** Everything the model is told to do, in the reader's language. */
function buildCompareSystem(locale: Locale): string {
  const es = locale === "es"
  return [
    es
      ? "Eres un ojeador de baloncesto con experiencia y le estás contestando de tú a tú a un entrenador que compara dos jugadores."
      : "You are an experienced basketball scout answering a coach who is comparing two players, one professional to another.",
    es
      ? "Te van a pasar los datos de los dos. Di a cuál te quedarías, para qué tipo de equipo y en qué rol, con la única razón que lo decide. Después nombra la situación concreta en la que el otro sería mejor elección. Mójate: nada de \"depende\" ni de elogios genéricos."
      : "You will be given the numbers for both. Say which one you would take, for what kind of team and in what role, with the single reason that decides it. Then name the one situation where the other player is the better pick. Commit: no hedging, no generic praise.",
    es
      ? "Prosa seguida y corta, sin listas, sin titulares y sin negrita. No repitas las cifras como un listado: usa dos como mucho, y solo donde una se gane su sitio en la frase."
      : "Short continuous prose: no lists, no headings, no bold. Do not restate the figures as a list — use two at most, and only where one earns its place in a sentence.",
    "",
    houseStyle(locale),
    "",
    aiLanguageDirective(locale),
  ].join("\n")
}

export async function POST(request: Request) {
  const ip = clientIp(request)

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

  // Display names come from the request body, not from the database, and they
  // are interpolated into the prompt. Capping them was never the same thing as
  // screening them.
  const names = [body.aName ?? aSlug, body.bName ?? bSlug].map((n) =>
    sanitisePromptInput(n, MAX_NAME_LEN),
  )
  const badName = names.find((n) => !n.ok)
  if (badName && !badName.ok) {
    audit("prompt-injection-blocked", {
      ip,
      route: "compare/ai",
      findings: badName.findings.slice(0, 5),
    })
    return NextResponse.json(
      { error: "Player names contain patterns that are not allowed." },
      { status: 400 },
    )
  }
  const aName = (names[0].ok ? names[0].text : "") || aSlug
  const bName = (names[1].ok ? names[1].text : "") || bSlug

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
    const guarded = aiOwnerKeyGuard(ip, user)
    if (guarded) return guarded
    const engine = user
      ? await resolveEngine(user.id, "compare")
      : await resolveDefaultEngine()
    if (engine.ok) {
      aiConfigured = true
      // The deterministic breakdown renders either way, so a rejected answer
      // costs the reader nothing — which is exactly why shipping a bad one
      // was inexcusable. What went out was a Spanish translation of our own
      // brief, presented as the comparison.
      const answer = await generateGroundedAnswer({
        engine,
        system: buildCompareSystem(locale),
        data: buildCompareData(aName, bName, result, locale),
        subjects: [aName, bName],
        locale,
        maxTokens: 320,
        temperature: 0.6,
        // Current form and injuries decide a comparison as much as last
        // season's averages do, so let the engine look them up if it can.
        webSearch: supportsNativeWebSearch(engine.provider),
        // Three or four sentences is a complete answer here.
        requireLength: false,
      })
      if (answer.ok) {
        aiSummary = answer.text
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
