import { listLeagueOverviews, listLeagueTopScorers } from "@/lib/data/leagues"
import { getSyncTimesBySource } from "@/lib/data/sync"
import type { LlmsLeague, LlmsScorer } from "@/lib/seo/llms"

/** The leagues as llms.txt describes them. Cached helpers only — no new queries. */
export async function loadLlmsLeagues(): Promise<
  Array<LlmsLeague & { id: string }>
> {
  const [overviews, syncTimes] = await Promise.all([
    listLeagueOverviews().catch(() => []),
    getSyncTimesBySource(),
  ])
  return overviews.map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    seasonLabel: l.seasonLabel,
    teamCount: l.teamCount,
    playerCount: l.playerCount,
    lastSync: syncTimes.get(l.slug) ?? null,
  }))
}

export async function loadLlmsScorers(
  leagues: Array<{ id: string; slug: string }>,
  limit: number,
): Promise<Map<string, LlmsScorer[]>> {
  const rows = await Promise.all(
    leagues.map(async (l) => {
      const scorers = await listLeagueTopScorers(l.id, limit).catch(() => [])
      return [
        l.slug,
        scorers.map((s) => ({
          fullName: s.fullName,
          slug: s.slug,
          teamName: s.team?.name ?? null,
          ppg: s.ppg,
        })),
      ] as const
    }),
  )
  return new Map(rows)
}
