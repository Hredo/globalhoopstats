import { NextResponse } from "next/server"
import { findSimilarPlayers } from "@/lib/market/similarity"
import { leagueSlugsFor } from "@/lib/league-groups"

export const runtime = "nodejs"
export const revalidate = 1800

/**
 * GET /api/players/:slug/similar
 *
 * Query params:
 *   - limit            (default 12, max 40)
 *   - samePosition     "1" to restrict to the target's position bucket
 *   - maxAge           cap candidate age
 *   - leagues          filter slug (e.g. "acb", "feb"); default = adjacent leagues
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  if (!slug || slug.length > 120) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = Math.min(
    40,
    Math.max(1, Number(url.searchParams.get("limit")) || 12),
  )
  const samePositionOnly = url.searchParams.get("samePosition") === "1"
  const maxAgeRaw = Number(url.searchParams.get("maxAge"))
  const maxAge = Number.isFinite(maxAgeRaw) && maxAgeRaw > 0 ? maxAgeRaw : undefined
  const leagueSlugs = leagueSlugsFor(url.searchParams.get("leagues")) ?? undefined

  try {
    const result = await findSimilarPlayers(slug, {
      limit,
      samePositionOnly,
      maxAge,
      leagueSlugs,
    })
    if (!result) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 })
    }

    return NextResponse.json(
      {
        target: {
          slug: result.target.slug,
          name: result.target.fullName,
          league: result.target.league,
          position: result.target.position,
          valuation: result.target.valuation,
        },
        results: result.results.map((r) => ({
          slug: r.player.slug,
          name: r.player.fullName,
          position: r.player.position,
          age: r.player.age,
          league: r.player.league,
          team: r.player.team,
          imageUrl: r.player.imageUrl,
          valuation: r.player.valuation,
          similarity: r.similarity,
          leagueNote: r.leagueNote,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
    )
  } catch {
    return NextResponse.json({ error: "Failed to compute similar players." }, { status: 500 })
  }
}
