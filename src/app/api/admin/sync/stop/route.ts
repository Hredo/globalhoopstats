import { NextResponse } from "next/server"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { requestCancel, syncSnapshot } from "@/lib/sync/controller"

export const dynamic = "force-dynamic"

/**
 * Request that the in-progress sync stop. Cancellation is cooperative and
 * checked between leagues, so any league already in flight finishes first while
 * the remaining queued leagues are skipped.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const cancelled = requestCancel()
  if (!cancelled) {
    return NextResponse.json(
      { ok: false, error: "No sync is running" },
      { status: 409 },
    )
  }
  return NextResponse.json({ ok: true, state: syncSnapshot() })
}
