/*
 * Postgres → MySQL parity harness.
 *
 * Runs the application's OWN data-access code against a real MySQL server and
 * asserts the results, rather than trusting that it type-checks. Every check
 * below targets something the migration could plausibly have broken:
 * RETURNING removal, upsert semantics, the [rows, fields] result shape,
 * accent folding, UTC handling and NULL ordering.
 *
 * Usage:
 *   DATABASE_URL="mysql://root:pw@127.0.0.1:3399/globalhoopstats" \
 *     pnpm exec tsx scripts/verify-mysql-parity.ts
 */
import { getDb, closeDb, rawRows } from "@/lib/db/client"
import {
  announcements,
  appConfig,
  leagues,
  newId,
  players,
  playerSeasonStats,
  seasons,
  syncRuns,
  teams,
  users,
  videos,
} from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function main() {
  const db = getDb()

  console.log("\n── connection ─────────────────────────────────────────────")
  const ver = await rawRows<{ v: string }>(
    db.execute(sql`select version() as v`),
  )
  console.log(`  server: ${ver[0]?.v}`)

  // ── raw result shape ─────────────────────────────────────────────────────
  console.log("\n── raw query result shape ─────────────────────────────────")
  const shape = await rawRows<{ n: number }>(
    db.execute(sql`select 42 as n`),
  )
  check("rawRows unwraps [rows, fields]", shape.length === 1 && Number(shape[0]?.n) === 42,
    JSON.stringify(shape))

  // ── FOUND_ROWS: affectedRows must mean "matched", not "changed" ───────────
  // The playbooks PUT/DELETE 404 logic depends on this.
  console.log("\n── affectedRows semantics ─────────────────────────────────")
  await db.delete(appConfig).where(eq(appConfig.key, "parity-probe"))
  await db.insert(appConfig).values({ key: "parity-probe", value: "v1" })
  const [sameValue] = await db
    .update(appConfig)
    .set({ value: "v1" }) // identical value → 0 "changed" rows
    .where(eq(appConfig.key, "parity-probe"))
  check(
    "affectedRows counts MATCHED rows (CLIENT_FOUND_ROWS on)",
    sameValue.affectedRows === 1,
    `got ${sameValue.affectedRows}; a 0 here would make playbook saves 404`,
  )
  const [noMatch] = await db
    .update(appConfig)
    .set({ value: "x" })
    .where(eq(appConfig.key, "does-not-exist"))
  check("affectedRows is 0 when nothing matches", noMatch.affectedRows === 0)

  // ── upsert (onDuplicateKeyUpdate) ────────────────────────────────────────
  console.log("\n── upsert ─────────────────────────────────────────────────")
  const leagueId = newId()
  await db
    .insert(leagues)
    .values({ id: leagueId, name: "Parity League", slug: "parity-league", region: "ES" })
    .onDuplicateKeyUpdate({ set: { name: "Parity League" } })
  await db
    .insert(leagues)
    .values({ id: newId(), name: "Parity League v2", slug: "parity-league", region: "ES" })
    .onDuplicateKeyUpdate({ set: { name: "Parity League v2", region: "EU" } })
  const leagueRows = await db.select().from(leagues).where(eq(leagues.slug, "parity-league"))
  check("upsert does not duplicate on unique slug", leagueRows.length === 1)
  check("upsert applied the update", leagueRows[0]?.name === "Parity League v2")
  check(
    "upsert PRESERVES the original id (read-back-by-slug is required)",
    leagueRows[0]?.id === leagueId,
    `expected ${leagueId}, got ${leagueRows[0]?.id}`,
  )

  // ── INSERT IGNORE (was onConflictDoNothing) ──────────────────────────────
  console.log("\n── insert ignore ──────────────────────────────────────────")
  const seasonId = newId()
  await db.insert(seasons).values({ id: seasonId, name: "PARITY-2026", isCurrent: true })
  const teamId = newId()
  await db.insert(teams).values({ id: teamId, name: "Parity Team", slug: "parity-team" })
  const playerId = newId()
  await db.insert(players).values({
    id: playerId, firstName: "Nikola", lastName: "Jokić", slug: "parity-jokic",
    position: "Center", heightCm: 211,
  })
  await db.insert(videos).ignore().values({
    playerId, youtubeId: "PARITYVID1", title: "t", thumbnailUrl: "u", publishedAt: null,
  })
  await db.insert(videos).ignore().values({
    playerId, youtubeId: "PARITYVID1", title: "other", thumbnailUrl: "u2", publishedAt: null,
  })
  const vids = await db.select().from(videos).where(eq(videos.youtubeId, "PARITYVID1"))
  check("insert ignore swallows the duplicate", vids.length === 1)
  check("insert ignore kept the FIRST row", vids[0]?.title === "t")

  // ── AUTO_INCREMENT + $returningId ────────────────────────────────────────
  console.log("\n── $returningId on AUTO_INCREMENT ─────────────────────────")
  const [run] = await db
    .insert(syncRuns)
    .values({ source: "parity", status: "running", rowsWritten: 0 })
    .$returningId()
  check("$returningId returns a numeric id", typeof run?.id === "number" && run.id > 0,
    JSON.stringify(run))
  const runRow = await db.select().from(syncRuns).where(eq(syncRuns.id, run!.id))
  check("the returned id addresses the real row", runRow[0]?.source === "parity")

  // ── datetime round-trip in UTC ───────────────────────────────────────────
  console.log("\n── datetime / UTC round-trip ──────────────────────────────")
  const when = new Date("2026-03-15T22:45:30.123Z")
  const annId = newId()
  await db.insert(announcements).values({
    id: annId, type: "banner", title: "parity", active: true, priority: 1,
    startsAt: when, createdAt: when, updatedAt: when,
  })
  const [ann] = await db.select().from(announcements).where(eq(announcements.id, annId))
  check(
    "datetime survives the round-trip exactly (no timezone drift)",
    ann?.startsAt?.getTime() === when.getTime(),
    `wrote ${when.toISOString()}, read ${ann?.startsAt?.toISOString()}`,
  )
  check("millisecond precision is preserved", ann?.startsAt?.getMilliseconds() === 123)

  // ── UTC_TIMESTAMP vs stored values ───────────────────────────────────────
  const drift = await rawRows<{ diff_sec: number }>(
    db.execute(sql`
      select timestampdiff(SECOND, ${new Date()}, UTC_TIMESTAMP(3)) as diff_sec
    `),
  )
  check(
    "UTC_TIMESTAMP agrees with bound JS Dates (< 5s apart)",
    Math.abs(Number(drift[0]?.diff_sec ?? 999)) < 5,
    `drift ${drift[0]?.diff_sec}s — raw SQL comparing now() would be wrong`,
  )

  // ── accent folding via collation ─────────────────────────────────────────
  console.log("\n── accent folding ─────────────────────────────────────────")
  const folded = await rawRows<{ hit: number }>(
    db.execute(sql`
      select count(*) as hit from players
      where (lower(concat(first_name, ' ', last_name)) collate utf8mb4_unicode_ci)
            like ${"%jokic%"}
    `),
  )
  check(
    "ASCII query matches a diacritic name (Jokić → jokic)",
    Number(folded[0]?.hit) === 1,
    "collation is not accent-insensitive",
  )

  // ── concat(), not || ─────────────────────────────────────────────────────
  const concat = await rawRows<{ full: string }>(
    db.execute(sql`select concat(first_name, ' ', last_name) as full from players where id = ${playerId}`),
  )
  check("concat() builds the full name", concat[0]?.full === "Nikola Jokić",
    JSON.stringify(concat[0]))

  // ── NULL ordering: PG "desc nulls last" == MySQL plain "desc" ────────────
  console.log("\n── NULL ordering ──────────────────────────────────────────")
  // Distinct seasons: (player, team, league, season) is uniquely indexed.
  for (const [i, pts] of [10, null, 30].entries()) {
    const s = newId()
    await db.insert(seasons).values({ id: s, name: `PARITY-ORD-${i}`, isCurrent: false })
    await db.insert(playerSeasonStats).values({
      id: newId(), playerId, teamId, leagueId, seasonId: s,
      gamesPlayed: 1, pointsTotal: pts,
    })
  }
  const ordered = await rawRows<{ points_total: number | null }>(
    db.execute(sql`
      select points_total from player_season_stats
      where player_id = ${playerId} order by points_total desc
    `),
  )
  check(
    "DESC puts NULLs last, matching Postgres' DESC NULLS LAST",
    ordered.length === 3 && ordered[0]?.points_total === 30 && ordered[2]?.points_total === null,
    JSON.stringify(ordered.map((r) => r.points_total)),
  )

  // ── reserved words ───────────────────────────────────────────────────────
  console.log("\n── reserved-word quoting ──────────────────────────────────")
  try {
    await db.execute(sql`INSERT INTO app_config (\`key\`, value, updated_at)
      VALUES (${"parity-reserved"}, ${"1"}, UTC_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = UTC_TIMESTAMP(3)`)
    const kv = await rawRows<{ key: string }>(
      db.execute(sql.raw("SELECT `key` FROM app_config WHERE `key` = 'parity-reserved'")),
    )
    check("`key` works as a quoted reserved word", kv.length === 1)
  } catch (err) {
    check("`key` works as a quoted reserved word", false, String(err))
  }

  // ── application data layer, end to end ───────────────────────────────────
  console.log("\n── application queries ────────────────────────────────────")
  // listTeams counts CURRENT-season roster rows only; the ordering fixtures
  // above deliberately used non-current seasons, so give it one to find.
  await db.insert(playerSeasonStats).values({
    id: newId(), playerId, teamId, leagueId, seasonId, gamesPlayed: 20, pointsTotal: 500,
  })
  // Both entry points route cache-less when a free-text query is present.
  // The cached path wraps unstable_cache, which only works inside the Next.js
  // runtime — irrelevant to whether the SQL is correct, which is what we test.
  const { listPlayers } = await import("@/lib/data/players")
  const { listTeams } = await import("@/lib/data/teams")
  try {
    const res = await listPlayers({ query: "jokic", pageSize: 5 })
    check("listPlayers() runs (CTE + window fn + collation)", res.items.length > 0,
      `${res.items.length} items, total ${res.total}`)
    check("listPlayers() maps the full name", res.items[0]?.fullName === "Nikola Jokić",
      JSON.stringify(res.items[0]?.fullName))
    check("listPlayers() query filter matched across the diacritic", res.total === 1,
      `total ${res.total}`)
  } catch (err) {
    check("listPlayers() runs", false, String(err))
  }
  try {
    const res = await listTeams({ query: "parity", pageSize: 5 })
    check("listTeams() runs (correlated distinct-count subquery)", res.items.length > 0,
      `${res.items.length} items`)
    check("listTeams() counts the roster", res.items[0]?.playerCount === 1,
      `playerCount ${res.items[0]?.playerCount}`)
  } catch (err) {
    check("listTeams() runs", false, String(err))
  }

  // ── rate limiter ─────────────────────────────────────────────────────────
  console.log("\n── rate limiter ───────────────────────────────────────────")
  const { consumeRateLimit } = await import("@/lib/security/rate-limit")
  const rlKey = `parity:${Date.now()}`
  const first = await consumeRateLimit(rlKey, 2, 60_000)
  const second = await consumeRateLimit(rlKey, 2, 60_000)
  const third = await consumeRateLimit(rlKey, 2, 60_000)
  check("1st request allowed", first.ok)
  check("2nd request allowed", second.ok)
  check("3rd request blocked past the limit", !third.ok,
    "the upsert-then-select counter is not incrementing")

  // ── admin analytics (FILTER → CASE, to_char → date_format) ───────────────
  console.log("\n── analytics aggregates ───────────────────────────────────")
  await db.insert(users).values({
    id: newId(), email: `parity-${Date.now()}@example.com`, name: "Parity",
  })
  try {
    const growth = await rawRows<{ month: string; registrations: number }>(
      db.execute(sql.raw(`
        SELECT date_format(created_at, '%Y-%m') AS month,
               CAST(count(*) AS SIGNED) AS registrations
        FROM users GROUP BY month ORDER BY month DESC LIMIT 24
      `)),
    )
    check("date_format replaces to_char", growth.length > 0 && /^\d{4}-\d{2}$/.test(growth[0]!.month),
      JSON.stringify(growth[0]))
  } catch (err) {
    check("date_format replaces to_char", false, String(err))
  }
  try {
    const overview = await rawRows<Record<string, number>>(
      db.execute(sql.raw(`
        SELECT CAST(count(*) AS SIGNED) AS total_views,
               CAST(count(CASE WHEN viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY THEN 1 END) AS SIGNED) AS views_30d,
               CAST(count(DISTINCT CASE WHEN viewed_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY THEN visitor_hash END) AS SIGNED) AS visitors_30d
        FROM page_views
      `)),
    )
    check("COUNT(CASE WHEN) replaces FILTER (WHERE)", overview.length === 1,
      JSON.stringify(overview[0]))
  } catch (err) {
    check("COUNT(CASE WHEN) replaces FILTER (WHERE)", false, String(err))
  }

  // ── json round-trip ──────────────────────────────────────────────────────
  // MariaDB has no native JSON type — `json` is an alias for LONGTEXT, so the
  // driver hands back a string where MySQL would hand back a parsed object.
  // Drizzle's json() column does the parsing itself, but that is worth pinning
  // down: shot_zones and playbook_plays.data both depend on it.
  console.log("\n── json columns ───────────────────────────────────────────")
  const [jsonCol] = await rawRows<{ data_type: string }>(
    db.execute(sql`
      select data_type from information_schema.columns
      where table_schema = database()
        and table_name = 'player_season_stats' and column_name = 'shot_zones'
    `),
  )
  console.log(`  shot_zones is stored as: ${jsonCol?.data_type}`)
  const zones = { paint: { m: 10, a: 20 }, leftCorner3: { m: 3, a: 7 } }
  const zoneStatId = newId()
  const jsonSeasonId = newId()
  await db.insert(seasons).values({ id: jsonSeasonId, name: "PARITY-JSON", isCurrent: false })
  await db.insert(playerSeasonStats).values({
    id: zoneStatId, playerId, teamId, leagueId, seasonId: jsonSeasonId,
    gamesPlayed: 1, shotZones: zones,
  })
  const [zoneRow] = await db
    .select()
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.id, zoneStatId))
  check(
    "json round-trips as an object, not a string",
    typeof zoneRow?.shotZones === "object" && zoneRow?.shotZones?.paint?.m === 10,
    `typeof ${typeof zoneRow?.shotZones}`,
  )

  // ── cascade deletes ──────────────────────────────────────────────────────
  console.log("\n── foreign keys ───────────────────────────────────────────")
  await db.delete(players).where(eq(players.id, playerId))
  const orphans = await db
    .select()
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.playerId, playerId))
  check("ON DELETE CASCADE removes dependent stat rows", orphans.length === 0,
    `${orphans.length} orphans left`)

  console.log(`\n${"─".repeat(60)}`)
  console.log(`${passed} passed, ${failed} failed`)
  await closeDb()
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error("\nharness crashed:", err)
  await closeDb()
  process.exit(1)
})
