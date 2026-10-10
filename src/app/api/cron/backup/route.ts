import { NextResponse } from "next/server"
import { checkCronSecret } from "@/lib/security/cron-auth"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { runBackup } from "@/lib/ops/backup"

export const dynamic = "force-dynamic"

let running = false

/**
 * Take a verified backup now. Normally it runs after the nightly sync; this is
 * the manual trigger (cron secret, or an admin from the panel). The response
 * never contains the server path, only the file name, size and hash.
 */
export async function POST(request: Request) {
  const auth = checkCronSecret(request.headers)
  if (auth !== "ok") {
    const user = await getCurrentUser(request.headers.get("cookie"))
    if (!isAdmin(user)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }
  }
  if (running) return NextResponse.json({ ok: false, error: "a backup is already running" }, { status: 409 })
  running = true
  try {
    const status = await runBackup()
    return NextResponse.json(
      { ...status, file: status.file?.split(/[\\/]/).pop() ?? null },
      { status: status.ok ? 200 : 500 },
    )
  } finally {
    running = false
  }
}
