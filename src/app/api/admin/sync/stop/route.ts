import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { requestCancel, requestCancelDb, syncSnapshot } from "@/lib/sync/controller"

export const dynamic = "force-dynamic"

/**
 * Stop the sync — robustly. Three things happen so the button always does
 * something, even on a stuck/zombie "RUNNING" row:
 *   1. in-memory cancel for a sync running in THIS process (queued leagues are
 *      skipped; an in-flight league finishes),
 *   2. a cross-process DB sentinel so a sync started from the terminal/cron in
 *      another process also aborts at its next league boundary,
 *   3. close every lingering "running" row in `sync_runs`, which clears the
 *      admin table immediately (this is what was stuck before: a dead process
 *      left a row "running" forever and the in-memory flag knew nothing about it).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const inProcess = requestCancel()
  await requestCancelDb()

  const db = getDb()
  const closed = await db
    .update(syncRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error: "cancelled by operator",
    })
    .where(eq(syncRuns.status, "running"))
    .returning({ id: syncRuns.id })

  return NextResponse.json({
    ok: true,
    inProcessCancelled: inProcess,
    runsClosed: closed.length,
    state: syncSnapshot(),
  })
}
