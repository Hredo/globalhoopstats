import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"

type Row = Record<string, unknown>

type Db = ReturnType<typeof getDb>

function query(db: Db, text: string): Promise<Row[]> {
  return rawRows<Row>(db.execute(sql.raw(text)))
}

/**
 * Run a query that depends on the newer page_views columns (referrer / device /
 * country / visitor_hash). If the migration that adds them hasn't been applied
 * yet, degrade gracefully to an empty result instead of 500-ing the whole page.
 */
async function safeQuery(db: Db, text: string): Promise<Row[]> {
  try {
    return await query(db, text)
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()

  const [playersMostViewed, teamsMostViewed, topSearches, userGrowth, leagueTrends] = await Promise.all([
    query(db, `
      SELECT pv.page_slug AS slug,
        concat(p.first_name, ' ', p.last_name) AS name,
        CAST(count(*) AS SIGNED) AS views
      FROM page_views pv
      LEFT JOIN players p ON p.slug = pv.page_slug AND pv.page_type = 'player'
      WHERE pv.page_type = 'player'
      GROUP BY pv.page_slug, p.first_name, p.last_name
      ORDER BY count(*) DESC
      LIMIT 20
    `),

    query(db, `
      SELECT pv.page_slug AS slug, t.name, CAST(count(*) AS SIGNED) AS views
      FROM page_views pv
      LEFT JOIN teams t ON t.slug = pv.page_slug AND pv.page_type = 'team'
      WHERE pv.page_type = 'team'
      GROUP BY pv.page_slug, t.name
      ORDER BY count(*) DESC
      LIMIT 20
    `),

    query(db, `
      SELECT \`query\`, CAST(count(*) AS SIGNED) AS count
      FROM search_log
      GROUP BY \`query\`
      ORDER BY count(*) DESC
      LIMIT 20
    `),

    query(db, `
      SELECT
        date_format(created_at, '%Y-%m') AS month,
        CAST(count(*) AS SIGNED) AS registrations
      FROM users
      GROUP BY month
      ORDER BY month DESC
      LIMIT 24
    `),

    query(db, `
      SELECT
        pv.league_slug AS slug,
        l.name,
        CAST(count(*) AS SIGNED) AS views
      FROM page_views pv
      LEFT JOIN leagues l ON l.slug = pv.league_slug
      WHERE pv.league_slug IS NOT NULL
      GROUP BY pv.league_slug, l.name
      ORDER BY count(*) DESC
      LIMIT 20
    `),
  ])

  // ── Newer, column-dependent aggregations (guarded) ────────────────────────
  const [overview, dailyTrend, topReferrers, deviceBreakdown, countryBreakdown] = await Promise.all([
    // MySQL has no aggregate FILTER clause; COUNT(CASE WHEN ...) is the
    // equivalent and, unlike SUM, still returns 0 rather than NULL when
    // nothing matches.
    safeQuery(db, `
      SELECT
        CAST(count(*) AS SIGNED) AS total_views,
        CAST(count(CASE WHEN viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY THEN 1 END) AS SIGNED) AS views_30d,
        CAST(count(CASE WHEN viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR THEN 1 END) AS SIGNED) AS views_24h,
        CAST(count(DISTINCT CASE WHEN viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY THEN visitor_hash END) AS SIGNED) AS visitors_30d,
        CAST(count(DISTINCT CASE WHEN viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR THEN visitor_hash END) AS SIGNED) AS visitors_24h
      FROM page_views
    `),

    safeQuery(db, `
      SELECT
        date_format(viewed_at, '%Y-%m-%d') AS day,
        CAST(count(*) AS SIGNED) AS views,
        CAST(count(DISTINCT visitor_hash) AS SIGNED) AS visitors
      FROM page_views
      WHERE viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
      GROUP BY day
      ORDER BY day ASC
    `),

    // Grouped by the raw column, not by the coalesced alias, so NULL referrers
    // collapse into one bucket exactly as they did under Postgres.
    safeQuery(db, `
      SELECT coalesce(referrer, 'direct') AS referrer, CAST(count(*) AS SIGNED) AS views
      FROM page_views
      WHERE viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
      GROUP BY page_views.referrer
      ORDER BY count(*) DESC
      LIMIT 12
    `),

    safeQuery(db, `
      SELECT coalesce(device, 'desconocido') AS device, CAST(count(*) AS SIGNED) AS views
      FROM page_views
      WHERE viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
      GROUP BY page_views.device
      ORDER BY count(*) DESC
    `),

    safeQuery(db, `
      SELECT coalesce(country, '??') AS country, CAST(count(*) AS SIGNED) AS views
      FROM page_views
      WHERE viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY AND country IS NOT NULL
      GROUP BY page_views.country
      ORDER BY count(*) DESC
      LIMIT 12
    `),
  ])

  return NextResponse.json({
    playersMostViewed,
    teamsMostViewed,
    topSearches,
    userGrowth,
    leagueTrends,
    overview: overview[0] ?? {
      total_views: 0,
      views_30d: 0,
      views_24h: 0,
      visitors_30d: 0,
      visitors_24h: 0,
    },
    dailyTrend,
    topReferrers,
    deviceBreakdown,
    countryBreakdown,
  })
}
