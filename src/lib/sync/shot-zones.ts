import { and, eq } from "drizzle-orm"
import type { getDb } from "@/lib/db/client"
import { playerSeasonStats } from "@/lib/db/schema"
import type { SourceAdapter } from "@/lib/sources/types"
import type { SourceShotZones } from "@/lib/sources/shot-zones"

/**
 * Shot locations are an extra, never a reason to fail a league's sync: a feed
 * that is down or rate-limited leaves last sync's zones in place.
 */
export async function fetchShotZonesSafely(
  adapter: SourceAdapter,
  tag: string,
): Promise<SourceShotZones[] | null> {
  if (!adapter.fetchShotZones) return null
  try {
    const lines = await adapter.fetchShotZones()
    console.log(`${tag} shot zones fetched (${lines.length} player lines)`)
    return lines
  } catch (err) {
    console.warn(
      `${tag} shot zones skipped — ${err instanceof Error ? err.message : err}`,
    )
    return null
  }
}

type Writer = Pick<ReturnType<typeof getDb>, "update">

/**
 * Attach each line to the player's stat row for that club. Only rows the stats
 * step wrote are touched, so a player with shots but no box-score line (a feed
 * mismatch) is skipped rather than given a placeholder row.
 */
export async function writeShotZones(
  db: Writer,
  lines: SourceShotZones[],
  ids: {
    leagueId: string
    seasonId: string
    playerIdBySourceId: Map<string, string>
    teamIdBySourceId: Map<string, string>
  },
): Promise<number> {
  let written = 0
  for (const line of lines) {
    const playerId = ids.playerIdBySourceId.get(line.playerSourceId)
    const teamId = ids.teamIdBySourceId.get(line.teamSourceId)
    if (!playerId || !teamId) continue
    await db
      .update(playerSeasonStats)
      .set({ shotZones: line.zones })
      .where(
        and(
          eq(playerSeasonStats.playerId, playerId),
          eq(playerSeasonStats.teamId, teamId),
          eq(playerSeasonStats.leagueId, ids.leagueId),
          eq(playerSeasonStats.seasonId, ids.seasonId),
        ),
      )
    written++
  }
  return written
}
