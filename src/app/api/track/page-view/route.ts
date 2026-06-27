import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"

// Cap stored values so a malicious client can't bloat the table; the strings
// are bound as parameters below, so they cannot break out of the query.
const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.slice(0, max) : null

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { pageType, pageSlug, leagueSlug } = body ?? {}

  const pt = str(pageType, 64)
  if (!pt) {
    return NextResponse.json({ error: "pageType is required" }, { status: 400 })
  }

  const db = getDb()
  // Parameterised query: values are bound, never string-interpolated, so this
  // is immune to SQL injection regardless of what the client sends.
  await db.execute(
    sql`INSERT INTO page_views (page_type, page_slug, league_slug)
        VALUES (${pt}, ${str(pageSlug, 200)}, ${str(leagueSlug, 64)})`,
  )

  return NextResponse.json({ ok: true })
}
