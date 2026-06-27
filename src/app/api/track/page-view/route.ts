import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { pageType, pageSlug, leagueSlug } = body

  if (!pageType) {
    return NextResponse.json({ error: "pageType is required" }, { status: 400 })
  }

  const db = getDb()
  await db.execute(
    sql.raw(
      `INSERT INTO page_views (page_type, page_slug, league_slug) VALUES ('${pageType}', ${pageSlug ? `'${pageSlug.replace(/'/g, "''")}'` : "NULL"}, ${leagueSlug ? `'${leagueSlug.replace(/'/g, "''")}'` : "NULL"})`,
    ),
  )

  return NextResponse.json({ ok: true })
}
