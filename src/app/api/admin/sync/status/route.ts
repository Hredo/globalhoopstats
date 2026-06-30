import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { syncRuns } from "@/lib/db/schema"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { syncSnapshot } from "@/lib/sync/controller"

export const dynamic = "force-dynamic"

/**
 * Current state of the manually-triggered sync (for admin polling). Reports BOTH
 * the in-process flag and whether any `sync_runs` row is still "running" in the
 * DB — the latter is what the admin table shows, and it can be a different (or
 * dead) process. The Stop button keys off `dbRunning` too, so it is never stuck
 * disabled on a zombie row.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const runningRows = await db
    .select({ id: syncRuns.id, source: syncRuns.source })
    .from(syncRuns)
    .where(eq(syncRuns.status, "running"))

  return NextResponse.json({
    ...syncSnapshot(),
    dbRunning: runningRows.length > 0,
    dbRunningSources: runningRows.map((r) => r.source),
  })
}
