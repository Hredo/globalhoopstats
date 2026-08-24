import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { resolveEngine } from "@/lib/ai/user-provider"
import { chatComplete } from "@/lib/ai/chat"
import { aiLanguageDirective } from "@/lib/ai/language"
import { tradeInstructions } from "@/lib/ai/trade-instructions"
import { getLocale } from "@/lib/i18n/server"
import type { Locale } from "@/lib/i18n/config"
import { cleanLlmOutput, clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { trimDegeneratedOutput } from "@/lib/ai/degeneration"
import { formatEur } from "@/lib/market/league-strength"
import { valuationTierLabel } from "@/lib/market/valuation"

export const dynamic = "force-dynamic"

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

function buildPrompt(body: TradeAiBody, locale: Locale): string {
  const lines: string[] = []

  lines.push(aiLanguageDirective(locale))
  lines.push("")
  lines.push("You are an expert basketball scout with deep knowledge of the NBA, EuroLeague and Liga ACB.")
  lines.push("")

  if (body.mode === "simular") {
    lines.push("# SYSTEM-GENERATED TRADE SIMULATION")
    lines.push("The system has generated automatic trade scenarios based on heuristic valuations.")
    lines.push("")

    const out = body.outgoing[0]
    lines.push(`## Player to trade: ${out.name}`)
    if (out.position) lines.push(`- Position: ${out.position}`)
    if (out.team) lines.push(`- Team: ${out.team}`)
    if (out.league) lines.push(`- League: ${out.league}`)
    if (out.valuation) {
      lines.push(`- Estimated market value: ${formatEur(out.valuation.eur)}`)
      lines.push(`- Estimated annual salary: ${formatEur(out.valuation.annualEur)}`)
      lines.push(`- Rating: ${out.valuation.rating}/100 (${valuationTierLabel(out.valuation.tier as any, out.valuation.leagueSlug, locale)})`)
    }
    lines.push("")

    if (body.scenarios && body.scenarios.length > 0) {
      lines.push("## System-generated scenarios")
      body.scenarios.forEach((s, i) => {
        lines.push(`### Scenario ${i + 1}: ${s.verdict} (balance ${s.balance.toFixed(2)})`)
        lines.push(`Combined value received: ${formatEur(s.combinedValueEur)}`)
        lines.push("Players included:")
        s.incoming.forEach((p) => {
          const stats = p.stats
          lines.push(`  - ${p.name} (${p.position ?? "?"}, ${p.team ?? "FA"})`)
          if (p.valuation) lines.push(`    Value: ${formatEur(p.valuation.eur)}, Rating: ${p.valuation.rating}/100`)
          if (stats) {
            const parts = []
            if (stats.pointsPerGame != null) parts.push(`${stats.pointsPerGame.toFixed(1)} PPG`)
            if (stats.reboundsPerGame != null) parts.push(`${stats.reboundsPerGame.toFixed(1)} RPG`)
            if (stats.assistsPerGame != null) parts.push(`${stats.assistsPerGame.toFixed(1)} APG`)
            if (parts.length) lines.push(`    Stats: ${parts.join(" · ")}`)
          }
        })
      })
    }
  } else {
    lines.push("# CUSTOM TRADE PROPOSAL")
    lines.push("The user has created a manual proposal with the following elements:")
    lines.push("")

    lines.push("## Players you give:")
    body.outgoing.forEach((p) => {
      lines.push(`  - ${p.name} (${p.position ?? "?"}, ${p.team ?? "FA"}, ${p.league ?? "?"})`)
      if (p.valuation) {
        lines.push(`    Market value: ${formatEur(p.valuation.eur)} · Rating: ${p.valuation.rating}/100`)
        lines.push(`    Profile: ${valuationTierLabel(p.valuation.tier as any, p.valuation.leagueSlug, locale)}`)
      }
      if (p.stats) {
        const parts = []
        if (p.stats.pointsPerGame != null) parts.push(`${p.stats.pointsPerGame.toFixed(1)} PPG`)
        if (p.stats.reboundsPerGame != null) parts.push(`${p.stats.reboundsPerGame.toFixed(1)} RPG`)
        if (p.stats.assistsPerGame != null) parts.push(`${p.stats.assistsPerGame.toFixed(1)} APG`)
        if (p.stats.stealsPerGame != null) parts.push(`${p.stats.stealsPerGame.toFixed(1)} SPG`)
        if (p.stats.blocksPerGame != null) parts.push(`${p.stats.blocksPerGame.toFixed(1)} BPG`)
        if (parts.length) lines.push(`    Stats: ${parts.join(" · ")}`)
      }
    })

    lines.push("")
    lines.push("## Players you receive:")
    body.incoming.forEach((p) => {
      lines.push(`  - ${p.name} (${p.position ?? "?"}, ${p.team ?? "FA"}, ${p.league ?? "?"})`)
      if (p.valuation) {
        lines.push(`    Market value: ${formatEur(p.valuation.eur)} · Rating: ${p.valuation.rating}/100`)
        lines.push(`    Profile: ${valuationTierLabel(p.valuation.tier as any, p.valuation.leagueSlug, locale)}`)
      }
      if (p.stats) {
        const parts = []
        if (p.stats.pointsPerGame != null) parts.push(`${p.stats.pointsPerGame.toFixed(1)} PPG`)
        if (p.stats.reboundsPerGame != null) parts.push(`${p.stats.reboundsPerGame.toFixed(1)} RPG`)
        if (p.stats.assistsPerGame != null) parts.push(`${p.stats.assistsPerGame.toFixed(1)} APG`)
        if (p.stats.stealsPerGame != null) parts.push(`${p.stats.stealsPerGame.toFixed(1)} SPG`)
        if (p.stats.blocksPerGame != null) parts.push(`${p.stats.blocksPerGame.toFixed(1)} BPG`)
        if (parts.length) lines.push(`    Stats: ${parts.join(" · ")}`)
      }
    })
  }

  const outVal = body.outgoing.reduce((s, p) => s + (p.valuation?.eur ?? 0), 0) + body.cash
  const inVal = body.incoming.reduce((s, p) => s + (p.valuation?.eur ?? 0), 0)
  const balance = outVal > 0 ? inVal / outVal : 0

  lines.push("")
  lines.push("## Financial summary")
  lines.push(`Total value given: ${formatEur(outVal)} (includes ${formatEur(body.cash)} in cash)`)
  lines.push(`Total value received: ${formatEur(inVal)}`)
  lines.push(
    `Balance: ${balance.toFixed(2)} (1.00 = an even swap by our estimated values; below 1 means you give up more than you get). This is our own estimate, not an official valuation — say so if you lean on it.`,
  )
  if (balance >= 0.95 && balance <= 1.08) lines.push("Status: Balanced")
  else if (balance < 0.95) lines.push("⚠ Status: You give more value than you receive")
  else lines.push("⚠ Status: You receive more value than you give")

  if (body.terms) {
    lines.push("")
    lines.push("## Additional terms")
    lines.push(body.terms)
  }

  lines.push("")
  lines.push("---")
  lines.push("")

  lines.push(...tradeInstructions(locale))

  return lines.join("\n")
}

export async function POST(request: Request) {
  // Every other AI route has this; this one did not. Auth is required, so it
  // is not an open door, but a stuck retry loop should not be able to burn a
  // user's own API credit either.
  const limit = await consumeRateLimit(`ai:${clientIp(request)}`, 30, 5 * 60 * 1000)
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

  try {
    const system =
      locale === "es"
        ? "Eres un director deportivo y scout de baloncesto de élite (NBA, EuroLeague, ACB). Analizas traspasos con criterio: cruzas valor de mercado, ajuste deportivo y riesgo, te mojas con un veredicto claro y, si el trato cojea, propones cómo equilibrarlo. Solo usas los datos que se te dan; no inventas cifras."
        : "You are an elite basketball general manager and scout (NBA, EuroLeague, ACB). You analyse trades with judgement: you cross-reference market value, on-court fit and risk, commit to a clear verdict and, if the deal is lopsided, propose how to balance it. You only use the data you are given; you never invent figures."
    const content = buildPrompt(body, locale)

    const result = await chatComplete({
      provider: engine.provider,
      model: engine.model,
      apiKey: engine.apiKey,
      system,
      messages: [{ role: "user", content }],
      // A 180-word report needs nowhere near 1100 tokens, and a smaller cap
      // is a smaller window for a weak model to wander off in.
      maxTokens: 500,
      temperature: 0.5,
      // Fail as JSON we control rather than as whatever the platform returns
      // when it kills a long request.
      timeoutMs: 55_000,
    })

    if (!result.ok) {
      const prefix = locale === "es" ? "Error del proveedor AI" : "AI provider error"
      return NextResponse.json(
        { error: `${prefix}: ${result.error}` },
        { status: 502 },
      )
    }

    return NextResponse.json({
      analysis: cleanLlmOutput(trimDegeneratedOutput(result.content).text),
      provider: engine.provider.id,
      model: result.model,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
