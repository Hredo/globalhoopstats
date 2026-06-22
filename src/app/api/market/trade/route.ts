import { NextResponse } from "next/server"
import { buildTradeScenarios, tradeVerdictLabel } from "@/lib/market/trade"
import type { MarketStatLine } from "@/lib/market/valuation"
import { leagueSlugsFor } from "@/lib/league-groups"
import { getLocale } from "@/lib/i18n/server"

export const runtime = "nodejs"

function perGameStats(stats: MarketStatLine) {
  const gp = stats.gamesPlayed || 1
  return {
    pointsPerGame: stats.pointsTotal != null ? Math.round((stats.pointsTotal / gp) * 10) / 10 : null,
    reboundsPerGame: stats.reboundsTotal != null ? Math.round((stats.reboundsTotal / gp) * 10) / 10 : null,
    assistsPerGame: stats.assistsTotal != null ? Math.round((stats.assistsTotal / gp) * 10) / 10 : null,
    stealsPerGame: stats.stealsTotal != null ? Math.round((stats.stealsTotal / gp) * 10) / 10 : null,
    blocksPerGame: stats.blocksTotal != null ? Math.round((stats.blocksTotal / gp) * 10) / 10 : null,
    fgPct: stats.fgPct != null ? Math.round(stats.fgPct * 1000) / 10 : null,
    threePct: stats.threePct != null ? Math.round(stats.threePct * 1000) / 10 : null,
    ftPct: stats.ftPct != null ? Math.round(stats.ftPct * 1000) / 10 : null,
    per: stats.per != null ? Math.round(stats.per * 10) / 10 : null,
    gamesPlayed: stats.gamesPlayed,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { myPlayerSlug, needPositions, leagueSlugs, maxScenarios } = body

    if (!myPlayerSlug || typeof myPlayerSlug !== "string") {
      return NextResponse.json(
        { error: "myPlayerSlug is required." },
        { status: 400 },
      )
    }

    const locale = await getLocale()

    const result = await buildTradeScenarios({
      myPlayerSlug,
      needPositions: needPositions ?? undefined,
      leagueSlugs: leagueSlugs
        ? leagueSlugsFor(leagueSlugs) ?? undefined
        : undefined,
      maxScenarios: maxScenarios ?? 8,
    })

    if (!result) {
      return NextResponse.json(
        { error: "Player not found in market pool." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      outgoing: {
        slug: result.outgoing.slug,
        name: result.outgoing.fullName,
        position: result.outgoing.position,
        age: result.outgoing.age,
        league: result.outgoing.league,
        team: result.outgoing.team,
        imageUrl: result.outgoing.imageUrl,
        valuation: result.outgoing.valuation,
        stats: perGameStats(result.outgoing.stats),
      },
      scenarios: result.scenarios.map((s) => ({
        combinedValueEur: s.combinedValueEur,
        balance: s.balance,
        verdict: tradeVerdictLabel(s.verdictKey, locale),
        incoming: s.incoming.map((p) => ({
          slug: p.slug,
          name: p.fullName,
          position: p.position,
          age: p.age,
          league: p.league,
          team: p.team,
          imageUrl: p.imageUrl,
          valuation: p.valuation,
          stats: perGameStats(p.stats),
        })),
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
