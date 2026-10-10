import { NextResponse } from "next/server"
import { apiJson, authenticateApi, API_HEADERS } from "@/lib/api/keys"
import { getPlayerLines } from "@/lib/scouting/profile"
import { metricValues, minutesPerGame, trueShooting } from "@/lib/scouting/metrics"
import { isSlug } from "@/lib/workspace/http"

export const dynamic = "force-dynamic"

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)

/** GET /api/v1/players/{slug} — identity plus every season line, newest first. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateApi(request)
  if ("response" in auth) return auth.response
  const { slug } = await params
  const notFound = NextResponse.json({ error: "Player not found." }, { status: 404, headers: API_HEADERS })
  if (!isSlug(slug)) return notFound
  const p = await getPlayerLines(slug)
  if (!p) return notFound
  return apiJson(
    {
      slug: p.slug,
      name: p.fullName,
      position: p.position,
      seasons: p.lines.map((l) => {
        const pg = metricValues(l.line, "perGame")
        return {
          season: l.season,
          league: l.leagueSlug,
          team: l.teamName,
          gamesPlayed: l.line.gamesPlayed,
          minutesPerGame: r1(minutesPerGame(l.line)),
          perGame: { pts: r1(pg.pts), reb: r1(pg.reb), ast: r1(pg.ast), stl: r1(pg.stl), blk: r1(pg.blk) },
          trueShooting: trueShooting(l.line),
          per: l.line.per,
        }
      }),
    },
    auth.remaining,
  )
}
