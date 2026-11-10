import { desc, eq, ne, and, sql } from "drizzle-orm"
import { after } from "next/server"
import { getDb, rawRows } from "@/lib/db/client"
import { videos } from "@/lib/db/schema"
import { findPlayerHighlight } from "@/lib/highlights/search"
import type { StoredVideo } from "@/lib/highlights/youtube"

export type GetVideoHints = {
  playerName: string
  teamName?: string | null
  leagueName?: string | null
}

/**
 * How long a player's clip is trusted before YouTube is searched again for a
 * newer one. `videos.created_at` records the last check, not the first insert.
 */
export const HIGHLIGHT_STALE_MS = 3 * 24 * 60 * 60_000

/** Players whose refresh is already running in this process. */
const refreshing = new Set<string>()
/**
 * Players with no clip have no videos row to stamp, so a miss is remembered
 * here instead; otherwise they would head every batch.
 */
const missedAt = new Map<string, number>()

export async function getPlayerVideo(
  playerId: string,
  hints: GetVideoHints,
): Promise<StoredVideo | null> {
  const db = getDb()

  const [cached] = await db
    .select({
      youtubeId: videos.youtubeId,
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      checkedAt: videos.createdAt,
    })
    .from(videos)
    .where(eq(videos.playerId, playerId))
    .orderBy(desc(videos.createdAt))
    .limit(1)

  if (cached) {
    // Serve what we have now; look for a newer clip after the response.
    if (Date.now() - cached.checkedAt.getTime() > HIGHLIGHT_STALE_MS) {
      after(() => refreshPlayerVideo(playerId, hints).then(() => undefined))
    }
    return {
      youtubeId: cached.youtubeId,
      title: cached.title,
      thumbnailUrl: cached.thumbnailUrl,
    }
  }

  // No clip on file: search after the response, never during it. The search
  // waits on third parties for up to eight seconds, and most of the catalogue
  // (the FEB tiers) has no clip to find — so every one of those profiles took
  // eight seconds to answer, on every request, crawlers included.
  if (Date.now() - (missedAt.get(playerId) ?? 0) > HIGHLIGHT_STALE_MS) {
    // Stamped up front so concurrent requests queue one search, not one each.
    missedAt.set(playerId, Date.now())
    after(() => refreshPlayerVideo(playerId, hints).then(() => undefined))
  }
  return null
}

/**
 * Search for the player's newest highlight and store it as their clip. A miss,
 * or a clip another player already holds (youtube_id is unique), keeps the
 * current one but still stamps the check so the player is not retried at once.
 */
export async function refreshPlayerVideo(
  playerId: string,
  hints: GetVideoHints,
): Promise<StoredVideo | null> {
  if (refreshing.has(playerId)) return null
  refreshing.add(playerId)
  const db = getDb()
  try {
    const found = await findPlayerHighlight({
      playerName: hints.playerName,
      teamName: hints.teamName ?? null,
      leagueName: hints.leagueName ?? null,
    })
    const now = new Date()

    if (found) {
      const [owner] = await db
        .select({ playerId: videos.playerId })
        .from(videos)
        .where(eq(videos.youtubeId, found.videoId))
        .limit(1)
      if (!owner) {
        await db.insert(videos).values({
          playerId,
          youtubeId: found.videoId,
          title: found.title,
          thumbnailUrl: found.thumbnailUrl,
          publishedAt: found.publishedAt,
          createdAt: now,
        })
      } else if (owner.playerId === playerId) {
        await db
          .update(videos)
          .set({
            title: found.title,
            publishedAt: found.publishedAt,
            createdAt: now,
          })
          .where(eq(videos.youtubeId, found.videoId))
      }
      if (!owner || owner.playerId === playerId) {
        await db
          .delete(videos)
          .where(
            and(
              eq(videos.playerId, playerId),
              ne(videos.youtubeId, found.videoId),
            ),
          )
        return {
          youtubeId: found.videoId,
          title: found.title,
          thumbnailUrl: found.thumbnailUrl,
        }
      }
    }

    await db
      .update(videos)
      .set({ createdAt: now })
      .where(eq(videos.playerId, playerId))
    missedAt.set(playerId, now.getTime())
    return found
      ? {
          youtubeId: found.videoId,
          title: found.title,
          thumbnailUrl: found.thumbnailUrl,
        }
      : null
  } catch (err) {
    console.error("[videos] highlight refresh failed:", err)
    return null
  } finally {
    refreshing.delete(playerId)
  }
}

let batchRunning = false

/**
 * Re-check the stalest highlights among this season's players, top-tier
 * leagues first. Run by /api/cron/highlights and after every data sync.
 */
export async function refreshStaleHighlights(limit: number): Promise<{
  checked: number
  updated: number
}> {
  if (batchRunning) return { checked: 0, updated: 0 }
  batchRunning = true
  try {
    const db = getDb()
    const cutoff = new Date(Date.now() - HIGHLIGHT_STALE_MS)
    const due = await rawRows<{
      id: string
      first_name: string
      last_name: string
      team: string | null
      league: string | null
      youtube_id: string | null
    }>(
      db.execute(sql`
        SELECT p.id, p.first_name, p.last_name,
               MIN(t.name) AS team, MIN(l.name) AS league,
               MAX(l.slug IN ('nba', 'euroleague', 'acb')) AS top_tier,
               (SELECT v.youtube_id FROM videos v WHERE v.player_id = p.id
                 ORDER BY v.created_at DESC LIMIT 1) AS youtube_id,
               (SELECT MAX(v.created_at) FROM videos v WHERE v.player_id = p.id) AS checked_at
        FROM player_season_stats pss
        JOIN seasons s ON s.id = pss.season_id AND s.is_current
        JOIN players p ON p.id = pss.player_id
        JOIN teams t ON t.id = pss.team_id
        JOIN leagues l ON l.id = pss.league_id
        GROUP BY p.id, p.first_name, p.last_name
        HAVING checked_at IS NULL OR checked_at < ${cutoff}
        ORDER BY top_tier DESC, checked_at IS NOT NULL, checked_at ASC
        LIMIT ${limit * 4}
      `),
    )
    const recentMiss = (id: string) =>
      Date.now() - (missedAt.get(id) ?? 0) < HIGHLIGHT_STALE_MS
    const batch = due.filter((row) => !recentMiss(row.id)).slice(0, limit)

    let updated = 0
    for (const row of batch) {
      const video = await refreshPlayerVideo(row.id, {
        playerName: `${row.first_name} ${row.last_name}`.trim(),
        teamName: row.team,
        leagueName: row.league,
      })
      if (video && video.youtubeId !== row.youtube_id) updated++
      // One search at a time, spaced out: these are third-party services.
      await new Promise((r) => setTimeout(r, 1_000))
    }
    return { checked: batch.length, updated }
  } finally {
    batchRunning = false
  }
}
