import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { and, eq, gt } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"
import { SOURCES, SOURCE_IDS, type SourceId } from "@/lib/sources"
import { runSync } from "@/lib/sync/run"
import { revalidateCacheTags } from "@/lib/sync/revalidate"
import { isInSeason } from "@/lib/sync/season-window"
import {
  beginSync,
  endSync,
  isCancelRequested,
  isSyncCancelled,
} from "@/lib/sync/controller"

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

/**
 * SCHEDULED sync trigger. The Hostinger deploy ships only the built app
 * (.next + node_modules + server.js) — the repo, pnpm and tsx are NOT on the
 * server — so the scheduled sync runs IN the web process, kicked by a plain
 * curl from a Hostinger cron job (see docs/SYNC.md):
 *
 *   0 5 * * *  curl -fsS -m 60 -X POST -H @$HOME/.cron-auth.hdr https://globalhoopstats.es/api/cron/sync?sources=nba,acb,euroleague
 *   0 6 * * 1  curl -fsS -m 60 -X POST -H @$HOME/.cron-auth.hdr https://globalhoopstats.es/api/cron/sync?sources=leb-oro,leb-plata,eba
 *
 * ($HOME/.cron-auth.hdr holds `X-Cron-Secret: <CRON_SECRET>`; the app writes
 * it on boot — see src/instrumentation.ts — so the secret never appears in
 * the inspectable cron command.)
 *
 * Fire-and-forget: responds 202 immediately and the sync continues in the
 * server process (same pattern as the admin panel's run route), so the curl
 * never has to hold a 20-minute connection through the proxy. Progress and
 * results land in sync_runs (visible in /admin#sync).
 *
 * Query params:
 *  - sources=a,b,c  subset of league slugs to sync (default: all)
 *  - force=1        ignore the off-season skip (backfill outside the season)
 *
 * Safety properties:
 *  - Auth: CRON_SECRET via `Authorization: Bearer` or `X-Cron-Secret` header
 *    (never the query string). X-Cron-Secret exists because Hostinger's cron
 *    UI mangles quoted arguments, and `Bearer <token>` needs quoting.
 *  - Season window: out-of-season leagues are skipped like the CLI does, so a
 *    scheduled run never wastes polite-scrape budget in July/August.
 *  - No DB corruption: runs the same per-league pipeline as `pnpm sync` — the
 *    quality gate blocks a broken scrape before any write and each league's
 *    writes commit in one transaction, so good data is never overwritten.
 *  - No double-run: an overlap guard (in-process lock + sync_runs check) skips
 *    if a sync is already in progress, so a cron retry can't start a second one.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const provided = (
    req.headers.get("x-cron-secret") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim()
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  /* ---- Target selection (mirrors scripts/sync.ts) ---- */
  const url = new URL(req.url)
  const force = ["1", "true"].includes(url.searchParams.get("force") ?? "")
  const sourcesParam = url.searchParams.get("sources")
  const requested: SourceId[] = sourcesParam
    ? sourcesParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is SourceId => (SOURCE_IDS as readonly string[]).includes(s))
    : [...SOURCE_IDS]
  if (sourcesParam && requested.length === 0) {
    return NextResponse.json(
      { ok: false, error: `no valid sources in "${sourcesParam}"` },
      { status: 400 },
    )
  }

  const skippedOffSeason = force ? [] : requested.filter((id) => !isInSeason(id))
  const targets = force ? requested : requested.filter((id) => isInSeason(id))
  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      started: false,
      reason: "all requested sources are off-season (pass force=1 to override)",
      skippedOffSeason,
    })
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
  if (!beginSync([...targets], "cron")) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "a sync is already in progress" },
      { status: 409 },
    )
  }

  // Detached: keep running after the response is sent. Never awaited.
  // Leagues run sequentially (like the CLI) to keep scrape traffic polite.
  const runStarted = Date.now()
  void (async () => {
    for (const id of targets) {
      // Honour a Stop pressed in the admin panel between leagues — both the
      // in-process flag and the cross-process DB sentinel count.
      if (isCancelRequested() || (await isSyncCancelled(runStarted))) {
        console.log("[cron/sync] cancelled — skipping remaining leagues")
        break
      }
      try {
        const r = await runSync(SOURCES[id])
        console.log(
          r.status === "ok"
            ? `[cron/sync] [${id}] ok in ${r.durationMs}ms — ${r.rowsWritten} rows`
            : `[cron/sync] [${id}] FAILED — ${r.error}`,
        )
      } catch (err) {
        console.error(`[cron/sync] [${id}] uncaught:`, err)
      }
    }
    await revalidateCacheTags().catch(() => {})
  })()
    .catch((err) => {
      console.error("[cron/sync] sync crashed:", err)
    })
    .finally(() => {
      endSync()
    })

  return NextResponse.json(
    { ok: true, started: true, targets, skippedOffSeason },
    { status: 202 },
  )
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST with header X-Cron-Secret: <CRON_SECRET> (or Authorization: Bearer) to run the data sync. " +
      "Optional: ?sources=nba,acb,euroleague&force=1. Responds 202; progress in /admin#sync.",
  })
}
