import { NextResponse } from "next/server"
import { apiJson, authenticateApi, API_HEADERS } from "@/lib/api/keys"
import { listTeams } from "@/lib/data/teams"
import { SOURCE_IDS } from "@/lib/sources"

export const dynamic = "force-dynamic"

/** GET /api/v1/teams?league=acb&season=2026-27 — the clubs of a league-season. */
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
  const res = await listTeams({
    league,
    season: url.searchParams.get("season") ?? undefined,
    pageSize: 200,
    sort: "name",
  })
  return apiJson(
    res.items.map((t) => ({ slug: t.slug, name: t.name, city: t.city, players: t.playerCount })),
    auth.remaining,
    { league, season: res.season, total: res.total },
  )
}
