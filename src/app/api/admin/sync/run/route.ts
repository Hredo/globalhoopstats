import { NextResponse } from "next/server"
import { and, eq, gt } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { SOURCE_IDS, type SourceId } from "@/lib/sources"
import { startGlobalSync } from "@/lib/sync/orchestrator"
import {
  beginSync,
  endSync,
  isCancelRequested,
  isSyncRunning,
  syncSnapshot,
} from "@/lib/sync/controller"

export const dynamic = "force-dynamic"

const IN_PROGRESS_WINDOW_MS = 45 * 60_000

/**
 * Manually trigger a sync from the admin panel. Accepts `{ source }` where
 * source is "all" (or omitted) for every league, or a single league slug.
 *
 * Fire-and-forget: the sync runs in the background on the long-running server
 * and the route returns immediately. The admin UI polls /status to track it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { source?: string }
  const source = body.source

  let targets: SourceId[]
  if (!source || source === "all") {
    targets = [...SOURCE_IDS]
  } else if ((SOURCE_IDS as string[]).includes(source)) {
    targets = [source as SourceId]
  } else {
    return NextResponse.json(
      { error: `Unknown source: ${source}` },
      { status: 400 },
    )
  }

  // Don't start if one is already running — in this process (admin) or recently
  // in the DB (e.g. the nightly cron on another worker).
  if (isSyncRunning()) {
    return NextResponse.json(
      { error: "A sync is already running", state: syncSnapshot() },
      { status: 409 },
    )
  }
  const db = getDb()
  const cutoff = new Date(Date.now() - IN_PROGRESS_WINDOW_MS)
  const dbRunning = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(and(eq(syncRuns.status, "running"), gt(syncRuns.startedAt, cutoff)))
    .limit(1)
  if (dbRunning.length > 0) {
    return NextResponse.json(
      { error: "A sync is already in progress" },
      { status: 409 },
    )
  }

  if (!beginSync(targets, "admin")) {
    return NextResponse.json(
      { error: "A sync is already running", state: syncSnapshot() },
      { status: 409 },
    )
  }

  // Detached: keep running after the response is sent. Never awaited.
  void startGlobalSync(targets, { shouldCancel: isCancelRequested })
    .catch((err) => {
      console.error("[admin/sync/run] sync failed:", err)
    })
    .finally(() => {
      endSync()
    })

  return NextResponse.json({ started: true, targets }, { status: 202 })
}
