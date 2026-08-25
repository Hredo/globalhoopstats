import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId } from "@/lib/db/schema"
import { clientIp, readRateLimit } from "@/lib/security/ai-advisor"

export async function POST(request: Request) {
  // Unauthenticated and it writes a row, so without a ceiling anyone with curl
  // can inflate the table and poison the admin analytics for free. The
  // in-memory limiter is deliberate: `consumeRateLimit` writes to the database
  // itself, which on an endpoint that fires once per page view would double
  // the very cost it is here to contain.
  const limited = readRateLimit(clientIp(request), "track:search", 40, 1)
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  const body = await request.json().catch(() => ({}))
  const { query, resultCount } = body ?? {}

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  // Coerce to a finite integer; never interpolate the raw client value.
  const count = Number.isFinite(Number(resultCount))
    ? Math.trunc(Number(resultCount))
    : 0

  const db = getDb()
  // Parameterised query — values are bound, immune to SQL injection.
  await db.execute(
    sql`INSERT INTO search_log (id, \`query\`, result_count)
        VALUES (${newId()}, ${query.slice(0, 200)}, ${count})`,
  )

  return NextResponse.json({ ok: true })
}
