import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { and, eq, gt } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"
import { SOURCE_IDS } from "@/lib/sources"
import { startGlobalSync } from "@/lib/sync/orchestrator"
import { beginSync, endSync, isCancelRequested } from "@/lib/sync/controller"

/** Constant-time string compare that never short-circuits on length. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/**
 * A run is considered "in progress" if a sync_runs row is still marked running
 * and was started within this window. Older running rows are treated as stale
 * (a crashed run) so the cron self-heals instead of being blocked forever.
 */
const IN_PROGRESS_WINDOW_MS = 45 * 60_000

export const dynamic = "force-dynamic"
// Note: maxDuration is honored by serverless platforms; on the self-hosted
// Hostinger Node server it is ignored and the handler runs to completion.

/**
 * Nightly data sync, triggered by Hostinger cron.
 *
 *   curl -fsS --max-time 1800 -X POST \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     https://globalhoopstats.es/api/cron/sync
 *
 * Safety properties:
 *  - Auth: CRON_SECRET via Authorization header only (never the query string).
 *  - No DB corruption: runs the gated global sync — the quality gate blocks any
 *    league whose scrape looks broken, so good data is never overwritten, and
 *    each league is isolated (one failing league doesn't abort the others).
 *  - No double-run: an overlap guard skips if a sync is already in progress, so
 *    a cron retry (e.g. after a client-side timeout) can't start a second sync.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const provided = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim()
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const db = getDb()

  // Overlap guard: bail if a sync started recently and is still running.
  const cutoff = new Date(Date.now() - IN_PROGRESS_WINDOW_MS)
  const inProgress = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(and(eq(syncRuns.status, "running"), gt(syncRuns.startedAt, cutoff)))
    .limit(1)
  if (inProgress.length > 0) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "a sync is already in progress" },
      { status: 409 },
    )
  }

  // Claim the in-process run lock too, so a manual admin sync and the cron can
  // never run at the same time (and an admin "stop" can halt this run).
  if (!beginSync([...SOURCE_IDS], "cron")) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "a sync is already in progress" },
      { status: 409 },
    )
  }
  try {
    const report = await startGlobalSync(undefined, {
      shouldCancel: isCancelRequested,
    })
    const succeeded = report.results.filter((r) => r.status === "ok").length
    const failed = report.results.filter((r) => r.status === "failed")
    return NextResponse.json({
      ok: failed.length === 0,
      durationMs: report.durationMs,
      leagues: report.results.length,
      succeeded,
      failedLeagues: failed.map((r) => ({ source: r.source, error: r.error })),
      results: report.results.map((r) => ({
        source: r.source,
        status: r.status,
        rowsWritten: r.rowsWritten,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    endSync()
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST with header Authorization: Bearer <CRON_SECRET> to run the nightly data sync.",
  })
}
