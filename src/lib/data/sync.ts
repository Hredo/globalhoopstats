import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"
import { cached } from "@/lib/data/cache"

const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v))

/**
 * Cached as ISO strings: unstable_cache round-trips through JSON, so a Date
 * would come back as a string and a Map as `{}`. The footer renders this on
 * every page, so uncached it was one query per page view. Tagged "leagues",
 * which the sync revalidates when it lands. A failed query throws through the
 * cache, so a DB blip is never cached as "never synced".
 */
const loadSyncTimes = cached(
  async (): Promise<{ latest: string | null; bySource: Array<[string, string]> }> => {
    const db = getDb()
    const [latestRows, sourceRows] = await Promise.all([
      rawRows<{ last: Date | string | null }>(
        db.execute(sql`
          select max(started_at) as last
          from sync_runs
          where status = 'ok'
        `),
      ),
      rawRows<{ source: string; last: Date | string | null }>(
        db.execute(sql`
          select source, max(coalesce(finished_at, started_at)) as last
          from sync_runs
          where status = 'ok'
          group by source
        `),
      ),
    ])
    const last = latestRows[0]?.last
    return {
      latest: last == null ? null : toDate(last).toISOString(),
      bySource: sourceRows.flatMap((r) =>
        r.last == null ? [] : [[r.source, toDate(r.last).toISOString()] as [string, string]],
      ),
    }
  },
  "sync-times:v1",
  ["leagues"],
  300,
)

export async function getLatestSyncTime(): Promise<Date | null> {
  try {
    const { latest } = await loadSyncTimes()
    return latest ? new Date(latest) : null
  } catch {
    return null
  }
}

/**
 * Last successful sync time per source (league slug). Powers the per-league
 * "data updated …" stamps. `source` in sync_runs is the league slug, e.g.
 * "acb", "leb-oro", "euroleague".
 */
export async function getSyncTimesBySource(): Promise<Map<string, Date>> {
  try {
    const { bySource } = await loadSyncTimes()
    return new Map(bySource.map(([source, iso]) => [source, new Date(iso)]))
  } catch {
    return new Map()
  }
}
