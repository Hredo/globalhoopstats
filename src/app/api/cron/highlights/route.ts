import { NextResponse } from "next/server"
import { checkCronSecret } from "@/lib/security/cron-auth"
import { refreshStaleHighlights } from "@/lib/data/videos"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 15
const MAX_LIMIT = 100

/**
 * Look for newer YouTube highlights for the players whose clip is oldest.
 * Detached like /api/cron/sync, so the cron's curl returns at once. Same auth:
 * X-Cron-Secret or Authorization: Bearer <CRON_SECRET>. `?limit=` caps how many
 * players one call re-checks.
 */
export async function POST(request: Request) {
  const auth = checkCronSecret(request.headers)
  if (auth === "unconfigured") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  if (auth !== "ok")
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    )

  const asked = Number(new URL(request.url).searchParams.get("limit"))
  const limit =
    Number.isInteger(asked) && asked > 0
      ? Math.min(asked, MAX_LIMIT)
      : DEFAULT_LIMIT

  void refreshStaleHighlights(limit)
    .then((r) =>
      console.log(
        `[cron/highlights] checked ${r.checked}, ${r.updated} new clip(s)`,
      ),
    )
    .catch((err) => console.error("[cron/highlights] failed:", err))

  return NextResponse.json({ ok: true, started: true, limit }, { status: 202 })
}
