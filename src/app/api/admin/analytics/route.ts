import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()

  const [playersMostViewed] = await db.execute(sql.raw(`
    SELECT pv.page_slug AS slug,
      concat(p.first_name, ' ', p.last_name) AS name,
      count(*)::int AS views
    FROM page_views pv
    LEFT JOIN players p ON p.slug = pv.page_slug AND pv.page_type = 'player'
    WHERE pv.page_type = 'player'
    GROUP BY pv.page_slug, p.first_name, p.last_name
    ORDER BY count(*) DESC
    LIMIT 20
  `))

  const [teamsMostViewed] = await db.execute(sql.raw(`
    SELECT pv.page_slug AS slug, t.name, count(*)::int AS views
    FROM page_views pv
    LEFT JOIN teams t ON t.slug = pv.page_slug AND pv.page_type = 'team'
    WHERE pv.page_type = 'team'
    GROUP BY pv.page_slug, t.name
    ORDER BY count(*) DESC
    LIMIT 20
  `))

  const [topSearches] = await db.execute(sql.raw(`
    SELECT query, count(*)::int AS count
    FROM search_log
    GROUP BY query
    ORDER BY count(*) DESC
    LIMIT 20
  `))

  const [userGrowth] = await db.execute(sql.raw(`
    SELECT
      to_char(created_at, 'YYYY-MM') AS month,
      count(*)::int AS registrations
    FROM users
    GROUP BY month
    ORDER BY month DESC
    LIMIT 24
  `))

  const [leagueTrends] = await db.execute(sql.raw(`
    SELECT
      pv.league_slug AS slug,
      l.name,
      count(*)::int AS views
    FROM page_views pv
    LEFT JOIN leagues l ON l.slug = pv.league_slug
    WHERE pv.league_slug IS NOT NULL
    GROUP BY pv.league_slug, l.name
    ORDER BY count(*) DESC
    LIMIT 20
  `))

  return NextResponse.json({
    playersMostViewed: playersMostViewed as unknown as { slug: string; name: string | null; views: number }[],
    teamsMostViewed: teamsMostViewed as unknown as { slug: string; name: string | null; views: number }[],
    topSearches: topSearches as unknown as { query: string; count: number }[],
    userGrowth: userGrowth as unknown as { month: string; registrations: number }[],
    leagueTrends: leagueTrends as unknown as { slug: string | null; name: string | null; views: number }[],
  })
}
