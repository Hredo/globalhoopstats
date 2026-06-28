import { NextResponse } from "next/server"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { syncSnapshot } from "@/lib/sync/controller"

export const dynamic = "force-dynamic"

/** Current state of the manually-triggered sync (for admin polling). */
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(syncSnapshot())
}
