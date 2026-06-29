import { and, eq, gt } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"
import { SOURCE_IDS } from "@/lib/sources"
import { startGlobalSync } from "@/lib/sync/orchestrator"
import { beginSync, endSync, isCancelRequested } from "@/lib/sync/controller"

/**
 * In-process nightly scheduler. Because the app runs as a long-lived Node
 * server, it can schedule its own data sync — no GitHub Actions, no external
 * cron service, and no CRON_SECRET juggling (it calls startGlobalSync directly,
 * in-process, so there's no HTTP round-trip to authenticate).
 *
 * Started once from `src/instrumentation.ts` on server boot.
 */

let scheduled = false
const IN_PROGRESS_WINDOW_MS = 45 * 60_000

/** ms from now until the next HH:00 in the server's local time. */
function msUntilHour(hour: number): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

/** DB-level guard so multiple server workers can't double-run. */
async function aSyncIsRunningInDb(): Promise<boolean> {
  try {
    const db = getDb()
    const cutoff = new Date(Date.now() - IN_PROGRESS_WINDOW_MS)
    const rows = await db
      .select({ id: syncRuns.id })
      .from(syncRuns)
      .where(and(eq(syncRuns.status, "running"), gt(syncRuns.startedAt, cutoff)))
      .limit(1)
    return rows.length > 0
  } catch {
    return false
  }
}

async function runNightly(): Promise<void> {
  if (await aSyncIsRunningInDb()) {
    console.log("[scheduler] skip — a sync is already in progress (db)")
    return
  }
  if (!beginSync([...SOURCE_IDS], "cron")) {
    console.log("[scheduler] skip — a sync is already running (this process)")
    return
  }
  console.log("[scheduler] nightly sync starting")
  try {
    const report = await startGlobalSync(undefined, {
      shouldCancel: isCancelRequested,
    })
    const ok = report.results.filter((r) => r.status === "ok").length
    console.log(
      `[scheduler] nightly sync done — ${ok}/${report.results.length} leagues ok`,
    )
  } catch (err) {
    console.error("[scheduler] nightly sync failed:", err)
  } finally {
    endSync()
  }
}

export function startScheduler(): void {
  if (scheduled) return
  scheduled = true
  const hour = Number(process.env.SYNC_HOUR ?? 4)

  const schedule = () => {
    const delay = msUntilHour(hour)
    console.log(
      `[scheduler] next nightly sync in ${(delay / 3_600_000).toFixed(1)}h ` +
        `(target ${hour}:00 server time)`,
    )
    setTimeout(() => {
      void runNightly().finally(schedule)
    }, delay)
  }
  schedule()
}
