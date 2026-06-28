import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { and, eq, lt } from "drizzle-orm"
import { getDb, closeDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"

/** Load .env then .env.local (local overrides), mirroring the other scripts. */
function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2]!.trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      process.env[m[1]!] = v
    }
  }
}

/**
 * Close out orphaned "running" sync rows — left behind when a sync process died
 * before flipping its row to ok/failed (crash, Ctrl-C, restart, aborted admin
 * request). These otherwise show as perpetual "RUNNING" in the admin panel.
 *
 *   pnpm db:cleanup-syncs        # close running rows older than 45 min
 *   pnpm db:cleanup-syncs 0      # close ALL running rows (use when none truly run)
 */
async function main() {
  loadEnv()
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
