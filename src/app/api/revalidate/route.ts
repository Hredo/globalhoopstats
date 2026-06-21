import { NextResponse, type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { timingSafeEqual } from "node:crypto"

/** Constant-time string compare that never short-circuits on length. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // Compare against itself to keep timing uniform, then fail.
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

const TAGS = [
  "leagues",
  "seasons",
  "teams",
  "players",
  "coaches",
  "team-stats",
  "player-stats",
] as const

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const url = new URL(req.url)
  // Secret is accepted ONLY via the Authorization header. Passing it in the
  // query string would leak it into access logs, proxies and Referer headers.
  const provided = auth.replace(/^Bearer\s+/i, "").trim()
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    )
  }

  const tagsParam = url.searchParams.get("tags")
  const requested = tagsParam
    ? tagsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [...TAGS]
  const invalid = requested.filter(
    (t) => !(TAGS as readonly string[]).includes(t),
  )
  const valid = requested.filter((t) => (TAGS as readonly string[]).includes(t))
  for (const tag of valid) revalidateTag(tag)

  return NextResponse.json({
    ok: true,
    invalidated: valid,
    ignored: invalid,
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST with header Authorization: Bearer <CRON_SECRET> (?tags=leagues,players to scope). The secret is no longer accepted via query string.",
  })
}
