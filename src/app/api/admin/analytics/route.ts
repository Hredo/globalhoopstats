import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"

function toArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === "object") {
    if (Symbol.iterator in raw) return Array.from(raw as Iterable<Record<string, unknown>>)
    const obj = raw as Record<string, unknown>
    if ("length" in obj && typeof obj.length === "number") return Array.from({ length: obj.length }, (_, i) => obj[i] as Record<string, unknown>)
  }
  return []
}

type Db = ReturnType<typeof getDb>

/**
 * Run a query that depends on the newer page_views columns (referrer / device /
 * country / visitor_hash). If the migration that adds them hasn't been applied
 * yet, degrade gracefully to an empty result instead of 500-ing the whole page.
 */
async function safeQuery(db: Db, query: string): Promise<Record<string, unknown>[]> {
  try {
    return toArray(await db.execute(sql.raw(query)))
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
    db.execute(sql.raw(`
      SELECT pv.page_slug AS slug,
        concat(p.first_name, ' ', p.last_name) AS name,
        count(*)::int AS views
      FROM page_views pv
      LEFT JOIN players p ON p.slug = pv.page_slug AND pv.page_type = 'player'
      WHERE pv.page_type = 'player'
      GROUP BY pv.page_slug, p.first_name, p.last_name
      ORDER BY count(*) DESC
      LIMIT 20
    `)).then(toArray),

    db.execute(sql.raw(`
      SELECT pv.page_slug AS slug, t.name, count(*)::int AS views
      FROM page_views pv
      LEFT JOIN teams t ON t.slug = pv.page_slug AND pv.page_type = 'team'
      WHERE pv.page_type = 'team'
      GROUP BY pv.page_slug, t.name
      ORDER BY count(*) DESC
      LIMIT 20
    `)).then(toArray),

    db.execute(sql.raw(`
      SELECT query, count(*)::int AS count
      FROM search_log
      GROUP BY query
      ORDER BY count(*) DESC
      LIMIT 20
    `)).then(toArray),

    db.execute(sql.raw(`
      SELECT
        to_char(created_at, 'YYYY-MM') AS month,
        count(*)::int AS registrations
      FROM users
      GROUP BY month
      ORDER BY month DESC
      LIMIT 24
    `)).then(toArray),

    db.execute(sql.raw(`
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
    `)).then(toArray),
  ])

  // ── Newer, column-dependent aggregations (guarded) ────────────────────────
  const [overview, dailyTrend, topReferrers, deviceBreakdown, countryBreakdown] = await Promise.all([
    safeQuery(db, `
      SELECT
        count(*)::int AS total_views,
        count(*) FILTER (WHERE viewed_at >= now() - interval '30 days')::int AS views_30d,
        count(*) FILTER (WHERE viewed_at >= now() - interval '24 hours')::int AS views_24h,
        count(DISTINCT visitor_hash) FILTER (WHERE viewed_at >= now() - interval '30 days')::int AS visitors_30d,
        count(DISTINCT visitor_hash) FILTER (WHERE viewed_at >= now() - interval '24 hours')::int AS visitors_24h
      FROM page_views
    `),

    safeQuery(db, `
      SELECT
        to_char(viewed_at, 'YYYY-MM-DD') AS day,
        count(*)::int AS views,
        count(DISTINCT visitor_hash)::int AS visitors
      FROM page_views
      WHERE viewed_at >= now() - interval '30 days'
      GROUP BY day
      ORDER BY day ASC
    `),

    safeQuery(db, `
      SELECT coalesce(referrer, 'direct') AS referrer, count(*)::int AS views
      FROM page_views
      WHERE viewed_at >= now() - interval '30 days'
      GROUP BY referrer
      ORDER BY count(*) DESC
      LIMIT 12
    `),

    safeQuery(db, `
      SELECT coalesce(device, 'desconocido') AS device, count(*)::int AS views
      FROM page_views
      WHERE viewed_at >= now() - interval '30 days'
      GROUP BY device
      ORDER BY count(*) DESC
    `),

    safeQuery(db, `
      SELECT coalesce(country, '??') AS country, count(*)::int AS views
      FROM page_views
      WHERE viewed_at >= now() - interval '30 days' AND country IS NOT NULL
      GROUP BY country
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
