import { NextResponse } from "next/server"
import { getMarketPlayerBySlug } from "@/lib/market/pool"
import { formatEur } from "@/lib/market/league-strength"

export const runtime = "nodejs"
export const revalidate = 1800

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  if (!slug || slug.length > 120) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  try {
    const player = await getMarketPlayerBySlug(slug)
    if (!player) {
      return NextResponse.json(
        { error: "Player not found or no stats." },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        slug: player.slug,
        name: player.fullName,
        position: player.position,
        age: player.age,
        league: player.league,
        team: player.team,
        stats: player.stats,
        valuation: player.valuation,
        formatted: {
          eur: formatEur(player.valuation.eur),
          annualEur: formatEur(player.valuation.annualEur),
        },
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to compute valuation." },
      { status: 500 },
    )
  }
}
