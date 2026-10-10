import { apiJson, authenticateApi } from "@/lib/api/keys"
import { listLeagues } from "@/lib/data/players"
import { latestSeasonName } from "@/lib/data/seasons"

export const dynamic = "force-dynamic"

/** GET /api/v1/leagues — every league with its current-season club and player counts. */
export async function GET(request: Request) {
  const auth = await authenticateApi(request)
  if ("response" in auth) return auth.response
  const leagues = await listLeagues()
  return apiJson(
    leagues.map((l) => ({
      slug: l.slug,
      name: l.name,
      region: l.region,
      teams: l.teamCount,
      players: l.playerCount,
    })),
    auth.remaining,
    { season: await latestSeasonName() },
  )
}
