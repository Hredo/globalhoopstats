import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { query, resultCount } = body

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const db = getDb()
  await db.execute(
    sql.raw(
      `INSERT INTO search_log (query, result_count) VALUES ('${query.replace(/'/g, "''")}', ${resultCount ?? 0})`,
    ),
  )

  return NextResponse.json({ ok: true })
}
