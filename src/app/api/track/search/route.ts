import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { newId } from "@/lib/db/schema"

export async function POST(request: Request) {
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
