import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { resolveEngine } from "@/lib/ai/user-provider"
import {
  answerFailureMessage,
  generateGroundedAnswer,
} from "@/lib/ai/answer"
import { supportsNativeWebSearch } from "@/lib/ai/chat"
import { aiLanguageDirective, replyLocale } from "@/lib/ai/language"
import { tradeInstructions } from "@/lib/ai/trade-instructions"
import { getLocale } from "@/lib/i18n/server"
import type { Locale } from "@/lib/i18n/config"
import {
  audit,
  clientIp,
  sanitisePromptInput,
} from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { formatEur } from "@/lib/market/league-strength"
import { valuationTierLabel } from "@/lib/market/valuation"

export const dynamic = "force-dynamic"

/** Extra conditions on a trade are a sentence or two, not a document. */
const MAX_TERMS_LEN = 600

type PlayerInfo = {
  name: string
  position: string | null
  team: string | null
  league: string | null
  valuation: {
    eur: number
    annualEur: number
    tier: string
    rating: number
    confidence: string
    leagueSlug?: string
  } | null
  stats?: {
    pointsPerGame?: number | null
    reboundsPerGame?: number | null
    assistsPerGame?: number | null
    stealsPerGame?: number | null
    blocksPerGame?: number | null
    per?: number | null
  } | null
}

type TradeAiBody = {
  mode: "simular" | "proponer"
  outgoing: PlayerInfo[]
  incoming: PlayerInfo[]
  cash: number
  terms: string
  scenarios?: {
    combinedValueEur: number
    balance: number
    verdict: string
    incoming: PlayerInfo[]
  }[]
}

/**
 * Data-block labels in the reader's language.
 *
 * The block used to be written in English under a Spanish system message and
 * Spanish instructions. A model handed "Financial summary" and told to write
 * in Spanish copies the heading it was given — which is exactly the mixed-
 * language output this fixes.
 */
type TradeLabels = {
  simHeading: string
  simIntro: string
  playerToTrade: (name: string) => string
  position: string
  team: string
  league: string
  marketValue: string
  annualSalary: string
  rating: string
  profile: string
  scenarios: string
  scenario: (n: number, verdict: string, balance: string) => string
  combined: string
  includes: string
  stats: string
  customHeading: string
  customIntro: string
  youGive: string
  youReceive: string
  freeAgent: string
  financial: string
  totalGiven: (total: string, cash: string) => string
  totalReceived: string
  balance: (v: string) => string
  balanced: string
  giveMore: string
  receiveMore: string
  terms: string
}

const LABELS: Record<Locale, TradeLabels> = {
  en: {
    simHeading: "Trade simulation",
    simIntro:
      "These scenarios were generated automatically from our own heuristic valuations.",
    playerToTrade: (name) => `Player to trade: ${name}`,
    position: "Position",
    team: "Team",
    league: "League",
    marketValue: "Estimated market value",
    annualSalary: "Estimated annual salary",
    rating: "Rating",
    profile: "Profile",
    scenarios: "Scenarios",
    scenario: (n, verdict, balance) =>
      `Scenario ${n}: ${verdict} (balance ${balance})`,
    combined: "Combined value received",
    includes: "Players included:",
    stats: "Stats",
    customHeading: "Trade proposal",
    customIntro: "The user has put this proposal together:",
    youGive: "Players you give",
    youReceive: "Players you receive",
    freeAgent: "free agent",
    financial: "The numbers",
    totalGiven: (total, cash) => `Total value given: ${total} (includes ${cash} in cash)`,
    totalReceived: "Total value received",
    balance: (v) =>
      `Balance: ${v} (1.00 = an even swap by our estimated values; below 1 means you give up more than you get). This is our own estimate, not an official valuation — say so if you lean on it.`,
    balanced: "Status: balanced",
    giveMore: "Status: you give more value than you receive",
    receiveMore: "Status: you receive more value than you give",
    terms: "Additional terms",
  },
  es: {
    simHeading: "Simulación de traspaso",
    simIntro:
      "Estos escenarios se han generado automáticamente con nuestras propias valoraciones heurísticas.",
    playerToTrade: (name) => `Jugador a traspasar: ${name}`,
    position: "Posición",
    team: "Equipo",
    league: "Liga",
    marketValue: "Valor de mercado estimado",
    annualSalary: "Sueldo anual estimado",
    rating: "Rating",
    profile: "Perfil",
    scenarios: "Escenarios",
    scenario: (n, verdict, balance) =>
      `Escenario ${n}: ${verdict} (balance ${balance})`,
    combined: "Valor combinado recibido",
    includes: "Jugadores incluidos:",
    stats: "Estadísticas",
    customHeading: "Propuesta de traspaso",
    customIntro: "El usuario ha montado esta propuesta:",
    youGive: "Jugadores que entregas",
    youReceive: "Jugadores que recibes",
    freeAgent: "agente libre",
    financial: "Los números",
    totalGiven: (total, cash) => `Valor total entregado: ${total} (incluye ${cash} en efectivo)`,
    totalReceived: "Valor total recibido",
    balance: (v) =>
      `Balance: ${v} (1,00 = intercambio equilibrado según nuestras valoraciones estimadas; por debajo de 1 entregas más de lo que recibes). Es una estimación nuestra, no una valoración oficial — dilo si te apoyas en ella.`,
    balanced: "Situación: equilibrado",
    giveMore: "Situación: entregas más valor del que recibes",
    receiveMore: "Situación: recibes más valor del que entregas",
    terms: "Condiciones adicionales",
  },
}

function buildPrompt(body: TradeAiBody, locale: Locale): string {
  const L = LABELS[locale] ?? LABELS.en
  const lines: string[] = []

  const statLine = (p: PlayerInfo, indent: string): void => {
    const s = p.stats
    if (!s) return
    const parts: string[] = []
    if (s.pointsPerGame != null) parts.push(`${s.pointsPerGame.toFixed(1)} PPG`)
    if (s.reboundsPerGame != null) parts.push(`${s.reboundsPerGame.toFixed(1)} RPG`)
    if (s.assistsPerGame != null) parts.push(`${s.assistsPerGame.toFixed(1)} APG`)
    if (s.stealsPerGame != null) parts.push(`${s.stealsPerGame.toFixed(1)} SPG`)
    if (s.blocksPerGame != null) parts.push(`${s.blocksPerGame.toFixed(1)} BPG`)
    if (parts.length) lines.push(`${indent}${L.stats}: ${parts.join(" · ")}`)
  }

  const sideList = (players: PlayerInfo[]): void => {
    players.forEach((p) => {
      lines.push(
        `  - ${p.name} (${p.position ?? "?"}, ${p.team ?? L.freeAgent}, ${p.league ?? "?"})`,
      )
      if (p.valuation) {
        lines.push(
          `    ${L.marketValue}: ${formatEur(p.valuation.eur)} · ${L.rating}: ${p.valuation.rating}/100`,
        )
        lines.push(
          `    ${L.profile}: ${valuationTierLabel(p.valuation.tier as any, p.valuation.leagueSlug, locale)}`,
        )
      }
      statLine(p, "    ")
    })
  }

  if (body.mode === "simular") {
    lines.push(L.simHeading)
    lines.push(L.simIntro)
    lines.push("")

    const out = body.outgoing[0]
    lines.push(L.playerToTrade(out.name))
    if (out.position) lines.push(`- ${L.position}: ${out.position}`)
    if (out.team) lines.push(`- ${L.team}: ${out.team}`)
    if (out.league) lines.push(`- ${L.league}: ${out.league}`)
    if (out.valuation) {
      lines.push(`- ${L.marketValue}: ${formatEur(out.valuation.eur)}`)
      lines.push(`- ${L.annualSalary}: ${formatEur(out.valuation.annualEur)}`)
      lines.push(
        `- ${L.rating}: ${out.valuation.rating}/100 (${valuationTierLabel(out.valuation.tier as any, out.valuation.leagueSlug, locale)})`,
      )
    }
    lines.push("")

    if (body.scenarios && body.scenarios.length > 0) {
      lines.push(L.scenarios)
      body.scenarios.forEach((s, i) => {
        lines.push(L.scenario(i + 1, s.verdict, s.balance.toFixed(2)))
        lines.push(`${L.combined}: ${formatEur(s.combinedValueEur)}`)
        lines.push(L.includes)
        s.incoming.forEach((p) => {
          lines.push(`  - ${p.name} (${p.position ?? "?"}, ${p.team ?? L.freeAgent})`)
          if (p.valuation) {
            lines.push(
              `    ${L.marketValue}: ${formatEur(p.valuation.eur)} · ${L.rating}: ${p.valuation.rating}/100`,
            )
          }
          statLine(p, "    ")
        })
      })
    }
  } else {
    lines.push(L.customHeading)
    lines.push(L.customIntro)
    lines.push("")
    lines.push(L.youGive)
    sideList(body.outgoing)
    lines.push("")
    lines.push(L.youReceive)
    sideList(body.incoming)
  }

  const outVal = body.outgoing.reduce((s, p) => s + (p.valuation?.eur ?? 0), 0) + body.cash
  const inVal = body.incoming.reduce((s, p) => s + (p.valuation?.eur ?? 0), 0)
  const balance = outVal > 0 ? inVal / outVal : 0

  lines.push("")
  lines.push(L.financial)
  lines.push(L.totalGiven(formatEur(outVal), formatEur(body.cash)))
  lines.push(`${L.totalReceived}: ${formatEur(inVal)}`)
  lines.push(L.balance(balance.toFixed(2)))
  // No warning glyph: the house style forbids emoji in the answer, and a model
  // shown one in its data reliably copies it back out.
  if (balance >= 0.95 && balance <= 1.08) lines.push(L.balanced)
  else if (balance < 0.95) lines.push(L.giveMore)
  else lines.push(L.receiveMore)

  if (body.terms) {
    lines.push("")
    lines.push(L.terms)
    lines.push(body.terms)
  }

  // No instructions past this point. They used to be appended right here, at
  // the end of the user turn, and a small model treated them as material: one
  // report came back as "Paso 1: Valor de mercado / Paso 2: Ajuste deportivo /
  // Paso 3: Riesgo y equilibrio" — our own four required points, turned into
  // four headings, with every figure invented. They live in the system prompt
  // now. For the same reason the block above carries no markdown headings: a
  // model shown a document with "## " titles writes one back.
  return lines.join("\n")
}

/** Every name in the deal, for the grounding check on the way back. */
function subjectNames(body: TradeAiBody): string[] {
  const names = [
    ...body.outgoing.map((p) => p.name),
    ...body.incoming.map((p) => p.name),
    ...(body.scenarios ?? []).flatMap((s) => s.incoming.map((p) => p.name)),
  ]
  return names.filter((n) => typeof n === "string" && n.trim().length > 0)
}

export async function POST(request: Request) {
  // Every other AI route has this; this one did not. Auth is required, so it
  // is not an open door, but a stuck retry loop should not be able to burn a
  // user's own API credit either.
  const ip = clientIp(request)
  const limit = await consumeRateLimit(`ai:${ip}`, 30, 5 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limit.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    )
  }

  let body: TradeAiBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  if (!body.mode) {
    return NextResponse.json({ error: "mode is required." }, { status: 400 })
  }

  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const locale = await getLocale()

  const engine = await resolveEngine(user.id, "advisor")
  if (!engine.ok) {
    const reasons: Record<string, string> =
      locale === "es"
        ? {
            not_selected: "No has configurado un proveedor de IA. Ve a Ajustes → AI & keys.",
            unknown_provider: "Proveedor de IA no reconocido.",
            no_key: "No hay API key para el proveedor seleccionado.",
            decrypt_failed: "Error al descifrar tu API key.",
          }
        : {
            not_selected: "You haven't configured an AI provider. Go to Settings → AI & keys.",
            unknown_provider: "Unrecognised AI provider.",
            no_key: "No API key for the selected provider.",
            decrypt_failed: "Failed to decrypt your API key.",
          }
    const fallback = locale === "es" ? "AI no configurado." : "AI not configured."
    return NextResponse.json(
      { error: reasons[engine.reason] ?? fallback, aiConfigured: false },
      { status: 400 },
    )
  }

  // `terms` is free text from the browser and went into the prompt raw and
  // uncapped — no length limit, no injection screen.
  const terms = sanitisePromptInput(body.terms, MAX_TERMS_LEN)
  if (!terms.ok) {
    audit("prompt-injection-blocked", {
      ip,
      route: "market/trade/ai",
      findings: terms.findings.slice(0, 5),
    })
    return NextResponse.json(
      {
        error:
          "The additional terms contain patterns that are not allowed. Rephrase them as normal trade conditions.",
      },
      { status: 400 },
    )
  }
  body.terms = terms.text

  // A coach who writes the extra terms in Spanish gets a Spanish report, the
  // same rule the advisor and the playbook follow.
  const answerLocale = replyLocale(terms.text, locale)

  try {
    const persona =
      answerLocale === "es"
        ? "Eres un director deportivo y scout de baloncesto de élite (NBA, EuroLeague, ACB). Analizas traspasos con criterio: cruzas valor de mercado, ajuste deportivo y riesgo, te mojas con una decisión clara y, si el trato cojea, propones cómo equilibrarlo. Solo usas los datos que se te dan; no inventas cifras."
        : "You are an elite basketball general manager and scout (NBA, EuroLeague, ACB). You analyse trades with judgement: you cross-reference market value, on-court fit and risk, commit to a clear call and, if the deal is lopsided, propose how to balance it. You only use the data you are given; you never invent figures."
    // The brief goes in the system turn, not appended to the data.
    const brief = tradeInstructions(answerLocale).join("\n")
    const system = [
      persona,
      "",
      brief,
      "",
      aiLanguageDirective(answerLocale),
    ].join("\n")
    const answer = await generateGroundedAnswer({
      engine,
      system,
      data: buildPrompt(body, answerLocale),
      subjects: subjectNames(body),
      locale: answerLocale,
      // Enough room to cover a multi-player package properly now that the
      // report is no longer capped at 180 words, but still short of the cap
      // the advisor gets — a trade note that runs long is a trade note nobody
      // reads.
      maxTokens: 900,
      temperature: 0.5,
      // Let the engine check the contract situation and the rumours if it can.
      // An outside figure is then only accepted with a citation next to it.
      webSearch: supportsNativeWebSearch(engine.provider),
    })

    if (!answer.ok) {
      // 200, not 502. The request was valid, our server is healthy, and the
      // body carries the explanation the user needs to act on — but a 5xx
      // travels through Cloudflare, which may replace the body with its own
      // error page, and then the browser gets HTML where it expected JSON and
      // the reader is told only "failed to load resource". The failure is in
      // the payload, where every other AI surface on the site puts it.
      return NextResponse.json({
        analysis: null,
        error: answerFailureMessage(answer, answerLocale),
        aiConfigured: true,
      })
    }

    return NextResponse.json({
      analysis: answer.text,
      provider: engine.provider.id,
      model: answer.model,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
