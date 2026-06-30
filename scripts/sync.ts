import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { SOURCES, SOURCE_IDS, type SourceId } from "@/lib/sources"
import { runSync, shutdown, summarizeDb, type SyncResult } from "@/lib/sync/run"
import { revalidateCacheTags } from "@/lib/sync/revalidate"
import { isSyncCancelled } from "@/lib/sync/controller"
import { isInSeason } from "@/lib/sync/season-window"

/**
 * Load .env then .env.local (local overrides) so `pnpm sync:*` works straight
 * from a terminal. The app (Next.js) and cron load env on their own; the bare
 * `tsx` CLI does not, so without this DATABASE_URL is undefined. Mirrors the
 * loader the other standalone scripts use.
 */
function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2]!.trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[m[1]!]) process.env[m[1]!] = v
    }
  }
}

function parseTargets(argv: string[]): SourceId[] {
  const args = argv.slice(2).filter((a) => !a.startsWith("--"))
  if (args.length === 0) return SOURCE_IDS
  const valid = SOURCE_IDS
  return args
    .map((a) => a.toLowerCase())
    .filter((a): a is SourceId => (valid as string[]).includes(a))
}

function formatResult(r: SyncResult): string {
  if (r.status === "failed") {
    return `[${r.source}] FAILED in ${r.durationMs}ms — ${r.error}`
  }
  return (
    `[${r.source}] OK in ${r.durationMs}ms — ` +
    `teams: ${r.totals.teams}, players: ${r.totals.players}, stats: ${r.totals.stats}, ` +
    `coaches: ${r.totals.coaches}, team_stats: ${r.totals.teamStats}`
  )
}

async function main() {
  loadEnv()
  const runStarted = Date.now()
  // `--force` ignores the off-season skip (use to backfill outside the season).
  const force = process.argv.includes("--force")
  const requested = parseTargets(process.argv)

  // Off-season sources are skipped on a scheduled run — no games means nothing
  // to scrape, and not hammering a site out of season protects the IP.
  const targets = requested.filter((id) => {
    if (force || isInSeason(id)) return true
    console.log(`⏭ skip ${id} — off-season (pass --force to run anyway)`)
    return false
  })
  if (targets.length === 0) {
    console.log("→ nothing to sync (all requested sources off-season)")
    shutdown()
    return
  }
  console.log(
    `→ syncing ${targets.join(", ")} (season ${SOURCES[targets[0]!].season})${force ? " [forced]" : ""}`,
  )

  const results: SyncResult[] = []
  for (const id of targets) {
    // Honour a Stop pressed in the admin panel even for this separate CLI
    // process: bail before starting the next league.
    if (await isSyncCancelled(runStarted)) {
      console.log(`↩ sync cancelled — skipping remaining leagues`)
      break
    }
    try {
      const r = await runSync(SOURCES[id])
      results.push(r)
      console.log(formatResult(r))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[${id}] uncaught: ${message}`)
      results.push({
        source: id,
        status: "failed",
        durationMs: 0,
        rowsWritten: 0,
        error: message,
        totals: { teams: 0, players: 0, stats: 0, coaches: 0, teamStats: 0 },
      })
    }
  }

  const summary = await summarizeDb()
  console.log(
    `\nDB totals → leagues: ${summary.leagues}, teams: ${summary.teams}, ` +
      `players: ${summary.players}, stats rows: ${summary.stats}, ` +
      `coaches: ${summary.coaches}, team_stats: ${summary.teamStats}`,
  )

  await revalidateCacheTags()

  shutdown()
  const failed = results.filter((r) => r.status === "failed")
  if (failed.length > 0 && failed.length === results.length) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
