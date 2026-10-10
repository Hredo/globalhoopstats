import { NextResponse } from "next/server"
import { checkCronSecret } from "@/lib/security/cron-auth"
import { runAlerts } from "@/lib/alerts/engine"

export const dynamic = "force-dynamic"

/**
 * Run the follow alerts on demand. They already run after every data sync
 * (lib/ops/after-sync.ts); this is for a manual re-run. Same auth as
 * /api/cron/sync: X-Cron-Secret or Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(request: Request) {
  const auth = checkCronSecret(request.headers)
  if (auth === "unconfigured") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 })
  }
  if (auth !== "ok") return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  return NextResponse.json({ ok: true, ...(await runAlerts()) })
}
