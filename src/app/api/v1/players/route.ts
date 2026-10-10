import { NextResponse } from "next/server"
import { apiJson, authenticateApi, API_HEADERS } from "@/lib/api/keys"
import { getLeagueField } from "@/lib/scouting/profile"
import { metricValues, minutesPerGame, trueShooting } from "@/lib/scouting/metrics"
import { resolveSeasonName } from "@/lib/data/seasons"
import { SOURCE_IDS } from "@/lib/sources"

export const dynamic = "force-dynamic"

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
const r3 = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000)

/**
 * GET /api/v1/players?league=acb&season=2026-27&page=1&limit=50
 * One league-season at a time, paginated (limit ≤ 100), sorted by points.
 */
export async function GET(request: Request) {
  const auth = await authenticateApi(request)
  if ("response" in auth) return auth.response
  const url = new URL(request.url)
  const league = url.searchParams.get("league") ?? ""
  if (!(SOURCE_IDS as readonly string[]).includes(league)) {
    return NextResponse.json(
      { error: `league is required: one of ${SOURCE_IDS.join(", ")}` },
      { status: 400, headers: API_HEADERS },
    )
  }
  const season = await resolveSeasonName(url.searchParams.get("season"), league)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50))
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)

  const field = [...(await getLeagueField(league, season))].sort(
    (a, b) => (b.line.pointsTotal ?? 0) - (a.line.pointsTotal ?? 0),
  )
  const slice = field.slice((page - 1) * limit, page * limit)
  return apiJson(
    slice.map((f) => {
      const pg = metricValues(f.line, "perGame")
      const p40 = metricValues(f.line, "per40")
      return {
        slug: f.slug,
        name: f.fullName,
        team: f.teamName,
        gamesPlayed: f.line.gamesPlayed,
        minutesPerGame: r1(minutesPerGame(f.line)),
        perGame: { pts: r1(pg.pts), reb: r1(pg.reb), ast: r1(pg.ast), stl: r1(pg.stl), blk: r1(pg.blk) },
        per40: { pts: r1(p40.pts), reb: r1(p40.reb), ast: r1(p40.ast) },
        trueShooting: r3(trueShooting(f.line)),
        per: f.line.per,
      }
    }),
    auth.remaining,
    { league, season, page, limit, total: field.length },
  )
}
