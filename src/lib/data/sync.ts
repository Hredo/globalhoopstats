import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"

export async function getLatestSyncTime(): Promise<Date | null> {
  try {
    const db = getDb()
    const rows = await rawRows<{ last: Date | null }>(
      db.execute(sql`
        select max(started_at) as last
        from sync_runs
        where status = 'ok'
      `),
    )
    const last = rows[0]?.last
    if (last == null) return null
    return last instanceof Date ? last : new Date(last)
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
  const map = new Map<string, Date>()
  try {
    const db = getDb()
    const rows = await rawRows<{
      source: string
      last: Date | string | null
    }>(
      db.execute(sql`
        select source, max(coalesce(finished_at, started_at)) as last
        from sync_runs
        where status = 'ok'
        group by source
      `),
    )
    for (const r of rows) {
      if (r.last == null) continue
      map.set(r.source, r.last instanceof Date ? r.last : new Date(r.last))
    }
  } catch {
    // fall through to empty map
  }
  return map
}
