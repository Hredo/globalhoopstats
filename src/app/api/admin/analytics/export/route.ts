import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? "page-views"
  const db = getDb()

  let csv = ""
  let filename = ""

  if (type === "page-views") {
    const [rows] = await db.execute(sql.raw(`
      SELECT page_type, page_slug, league_slug, viewed_at
      FROM page_views
      ORDER BY viewed_at DESC
      LIMIT 10000
    `))
    csv = "page_type,page_slug,league_slug,viewed_at\n"
    for (const r of rows as unknown as { page_type: string; page_slug: string | null; league_slug: string | null; viewed_at: string }[]) {
      csv += `${r.page_type},${r.page_slug ?? ""},${r.league_slug ?? ""},${r.viewed_at}\n`
    }
    filename = "page-views.csv"
  } else if (type === "searches") {
    const [rows] = await db.execute(sql.raw(`
      SELECT query, result_count, searched_at
      FROM search_log
      ORDER BY searched_at DESC
      LIMIT 10000
    `))
    csv = "query,result_count,searched_at\n"
    for (const r of rows as unknown as { query: string; result_count: number; searched_at: string }[]) {
      csv += `"${r.query.replace(/"/g, '""')}",${r.result_count},${r.searched_at}\n`
    }
    filename = "searches.csv"
  } else if (type === "users") {
    const [rows] = await db.execute(sql.raw(`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS date, plan, role
      FROM users
      ORDER BY created_at DESC
      LIMIT 10000
    `))
    csv = "date,plan,role\n"
    for (const r of rows as unknown as { date: string; plan: string; role: string }[]) {
      csv += `${r.date},${r.plan},${r.role}\n`
    }
    filename = "users.csv"
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 })
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
