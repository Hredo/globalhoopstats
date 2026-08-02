import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()

  const tables = [
    "leagues", "seasons", "teams", "players",
    "player_season_stats", "coaches", "team_season_stats", "sync_runs",
  ] as const

  const rowCounts: Record<string, number> = {}
  for (const t of tables) {
    // `t` is from the fixed allowlist above; sql.identifier still quotes it
    // safely so this never becomes an injection vector.
    const counted = await rawRows<{ n: number }>(
      db.execute(sql`SELECT count(*) AS n FROM ${sql.identifier(t)}`),
    )
    rowCounts[t] = Number(counted[0]?.n ?? 0)
  }

  const leaguesStats = await rawRows<{
    slug: string
    name: string
    players: number
    teams: number
    seasons: number
    stat_rows: number
  }>(
    db.execute(sql.raw(`
      SELECT l.slug, l.name,
        CAST(count(DISTINCT pss.player_id) AS SIGNED) AS players,
        CAST(count(DISTINCT pss.team_id) AS SIGNED) AS teams,
        CAST(count(DISTINCT pss.season_id) AS SIGNED) AS seasons,
        CAST(count(*) AS SIGNED) AS stat_rows
      FROM player_season_stats pss
      JOIN leagues l ON l.id = pss.league_id
      GROUP BY l.slug, l.name ORDER BY l.slug
    `)),
  )

  const lastSync = await rawRows<{
    source: string
    status: string
    rows_written: number
    started_at: string
    finished_at: string | null
  }>(
    db.execute(sql.raw(`
      SELECT source, status, rows_written, started_at, finished_at
      FROM sync_runs ORDER BY started_at DESC LIMIT 15
    `)),
  )

  // `position` is back-quoted: MySQL also knows it as a function name.
  const nulls = await rawRows<Record<string, number>>(
    db.execute(sql.raw(`
      SELECT
        (SELECT CAST(count(*) AS SIGNED) FROM players) AS total_players,
        (SELECT CAST(count(*) AS SIGNED) FROM players WHERE \`position\` IS NULL) AS no_position,
        (SELECT CAST(count(*) AS SIGNED) FROM players WHERE height_cm IS NULL) AS no_height,
        (SELECT CAST(count(*) AS SIGNED) FROM players WHERE weight_kg IS NULL) AS no_weight,
        (SELECT CAST(count(*) AS SIGNED) FROM players WHERE nationality IS NULL) AS no_nationality,
        (SELECT CAST(count(*) AS SIGNED) FROM players WHERE image_url IS NULL) AS no_image,
        (SELECT CAST(count(*) AS SIGNED) FROM teams WHERE city IS NULL) AS teams_no_city,
        (SELECT CAST(count(*) AS SIGNED) FROM teams WHERE logo_url IS NULL) AS teams_no_logo
    `)),
  )

  const seasonStats = await rawRows<{ slug: string; season: string; n: number }>(
    db.execute(sql.raw(`
      SELECT l.slug, s.name AS season, CAST(count(*) AS SIGNED) AS n
      FROM player_season_stats pss
      JOIN leagues l ON l.id = pss.league_id
      JOIN seasons s ON s.id = pss.season_id
      GROUP BY l.slug, s.name ORDER BY l.slug, s.name
    `)),
  )

  return NextResponse.json({
    rowCounts,
    leaguesStats,
    lastSync,
    nulls: nulls[0] ?? {},
    seasonStats,
  })
}
