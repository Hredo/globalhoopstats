import { and, eq, lt } from "drizzle-orm"
import { getDb, closeDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"

/**
 * Close out orphaned "running" sync rows — left behind when a sync process died
 * before flipping its row to ok/failed (crash, Ctrl-C, restart, aborted admin
 * request). These otherwise show as perpetual "RUNNING" in the admin panel.
 *
 *   pnpm db:cleanup-syncs        # close running rows older than 45 min
 *   pnpm db:cleanup-syncs 0      # close ALL running rows (use when none truly run)
 */
async function main() {
  const db = getDb()
  const cutoffMin = Number(process.argv[2] ?? 45)
  const cutoff = new Date(Date.now() - cutoffMin * 60_000)

  const closed = await db
    .update(syncRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error: "stale run (manual cleanup)",
    })
    .where(and(eq(syncRuns.status, "running"), lt(syncRuns.startedAt, cutoff)))
    .returning({ id: syncRuns.id })

  console.log(
    `Closed ${closed.length} stale "running" sync row(s) older than ${cutoffMin} min.`,
  )
  closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
