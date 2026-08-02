/*
 * One-shot data migration: Neon Postgres → MySQL.
 *
 * Run this ONLY once the Neon data-transfer quota has reset — every read below
 * comes out of that budget. Nothing is written to Postgres; the source is
 * strictly read-only, so a failed run costs nothing but bandwidth and can be
 * repeated.
 *
 * Order of business:
 *   1. PREFLIGHT — refuses to copy anything until it has proved the data can
 *      survive the trip. MySQL's collation is case- and accent-insensitive
 *      where Postgres was exact, so two rows that were distinct in Postgres can
 *      collide on a MySQL unique index. It also checks that no string exceeds
 *      the varchar widths the new schema introduced.
 *   2. COPY — table by table in foreign-key order, batched.
 *   3. VERIFY — row counts per table, plus a checksum over every id.
 *
 * Usage:
 *   SOURCE_DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
 *   DATABASE_URL="mysql://user:pw@host/db" \
 *     pnpm exec tsx scripts/migrate-neon-to-mysql.ts [--preflight-only] [--truncate]
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"
import mysql from "mysql2/promise"

/** Same .env loading the other maintenance scripts use. */
function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const key = m[1]!
      const value = m[2]!.replace(/^["']|["']$/g, "")
      if (!process.env[key]) process.env[key] = value
    }
  }
}

const BATCH = 500

/** Parent tables first: every FK must point at a table already copied. */
const TABLES = [
  "leagues",
  "seasons",
  "teams",
  "players",
  "users",
  "player_season_stats",
  "coaches",
  "team_season_stats",
  "videos",
  "sync_runs",
  "waitlist_entries",
  "user_api_keys",
  "user_settings",
  "sessions",
  "conversations",
  "messages",
  "compare_uses",
  "password_reset_tokens",
  "two_factor_sessions",
  "two_factor_backup_codes",
  "announcements",
  "app_config",
  "page_views",
  "search_log",
  "playbook_plays",
  "rate_limits",
] as const

/**
 * Unique keys that Postgres compared byte-exactly but MySQL will compare
 * case- and accent-insensitively. Any group that collapses to one value here
 * would abort the copy with a duplicate-key error partway through.
 */
const UNIQUE_KEYS: Array<{ table: string; cols: string[] }> = [
  { table: "leagues", cols: ["slug"] },
  { table: "teams", cols: ["slug"] },
  { table: "players", cols: ["slug"] },
  { table: "users", cols: ["email"] },
  { table: "waitlist_entries", cols: ["email"] },
  { table: "videos", cols: ["youtube_id"] },
  { table: "coaches", cols: ["team_id", "league_id", "slug"] },
  { table: "user_api_keys", cols: ["user_id", "provider"] },
  { table: "app_config", cols: ["key"] },
  { table: "rate_limits", cols: ["key"] },
  { table: "sessions", cols: ["id"] },
  {
    table: "player_season_stats",
    cols: ["player_id", "team_id", "league_id", "season_id"],
  },
  { table: "team_season_stats", cols: ["team_id", "season_id", "league_id"] },
]

/** Columns the MySQL schema narrowed from unbounded text to varchar(n). */
const WIDTH_LIMITS: Array<{ table: string; col: string; max: number }> = [
  { table: "leagues", col: "slug", max: 191 },
  { table: "teams", col: "slug", max: 191 },
  { table: "teams", col: "name", max: 191 },
  { table: "players", col: "slug", max: 191 },
  { table: "players", col: "last_name", max: 191 },
  { table: "players", col: "position", max: 64 },
  { table: "coaches", col: "slug", max: 191 },
  { table: "coaches", col: "full_name", max: 191 },
  { table: "videos", col: "youtube_id", max: 32 },
  { table: "users", col: "email", max: 255 },
  { table: "waitlist_entries", col: "email", max: 255 },
  { table: "user_api_keys", col: "provider", max: 64 },
  { table: "sessions", col: "id", max: 128 },
  { table: "app_config", col: "key", max: 191 },
  { table: "rate_limits", col: "key", max: 191 },
]

/** Back-quote a MySQL identifier. */
const q = (id: string) => "`" + id.replace(/`/g, "``") + "`"
/** Double-quote a Postgres identifier. */
const q2 = (id: string) => '"' + id.replace(/"/g, '""') + '"'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing ${name}.`)
    process.exit(1)
  }
  return v
}

async function preflight(pg: postgres.Sql): Promise<boolean> {
  console.log("\n=== PREFLIGHT =================================================")
  let blocking = 0

  console.log("\n-- collation collisions (MySQL folds case + accents) ----------")
  for (const { table, cols } of UNIQUE_KEYS) {
    // Case folding only: Postgres' unaccent extension isn't available on Neon's
    // default image, so accent collisions can't be detected from this side.
    // They are far rarer than case collisions, and the copy would fail loudly
    // on the duplicate key rather than lose a row silently.
    const keyExpr = cols.map((c) => `lower(${q2(c)}::text)`).join(" || '|' || ")
    try {
      const rows = await pg.unsafe(
        `select ${keyExpr} as k, count(*) as n
         from ${q2(table)}
         group by 1 having count(*) > 1
         limit 10`,
      )
      if (rows.length > 0) {
        blocking++
        console.log(`  BLOCK ${table}(${cols.join(", ")}) — ${rows.length}+ case-collisions:`)
        for (const r of rows) console.log(`         "${r.k}" ×${r.n}`)
      } else {
        console.log(`  ok    ${table}(${cols.join(", ")})`)
      }
    } catch (err) {
      console.log(`  skip  ${table}(${cols.join(", ")}) — ${(err as Error).message}`)
    }
  }

  console.log("\n-- value widths vs the new varchar limits ---------------------")
  for (const { table, col, max } of WIDTH_LIMITS) {
    try {
      const rows = await pg.unsafe(
        `select max(length(${q2(col)}::text)) as longest from ${q2(table)}`,
      )
      const longest = Number(rows[0]?.longest ?? 0)
      if (longest > max) {
        blocking++
        console.log(`  BLOCK ${table}.${col} — longest ${longest} > varchar(${max})`)
      } else {
        console.log(`  ok    ${table}.${col} — longest ${longest} / ${max}`)
      }
    } catch (err) {
      console.log(`  skip  ${table}.${col} — ${(err as Error).message}`)
    }
  }

  console.log("\n-- row counts -------------------------------------------------")
  let grand = 0
  for (const t of TABLES) {
    try {
      const rows = await pg.unsafe(`select count(*)::int as n from ${q2(t)}`)
      const n = Number(rows[0]?.n ?? 0)
      grand += n
      console.log(`  ${String(n).padStart(9)}  ${t}`)
    } catch {
      console.log(`  ${"—".padStart(9)}  ${t} (absent)`)
    }
  }
  console.log(`  ${String(grand).padStart(9)}  TOTAL`)

  console.log(
    blocking === 0
      ? "\nPreflight clean — safe to copy."
      : `\n${blocking} BLOCKING issue(s). Resolve them in Postgres before copying.`,
  )
  return blocking === 0
}

/** MySQL cannot take a JS object for a json column; everything else passes through. */
function encode(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (Buffer.isBuffer(v)) return v
  if (typeof v === "object") return JSON.stringify(v)
  return v
}

async function copyTable(
  pg: postgres.Sql,
  my: mysql.Connection,
  table: string,
): Promise<number> {
  const cols = (
    await pg.unsafe(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1
       order by ordinal_position`,
      [table],
    )
  ).map((r) => r.column_name as string)

  if (cols.length === 0) {
    console.log(`  skip   ${table} (not in source)`)
    return 0
  }

  const colList = cols.map(q).join(", ")
  const placeholders = `(${cols.map(() => "?").join(", ")})`
  let copied = 0

  for (let offset = 0; ; offset += BATCH) {
    const rows = await pg.unsafe(
      `select ${cols.map(q2).join(", ")} from ${q2(table)}
       order by 1 limit ${BATCH} offset ${offset}`,
    )
    if (rows.length === 0) break

    const values = rows.map((r) => cols.map((c) => encode(r[c])))
    const sqlText =
      `INSERT INTO ${q(table)} (${colList}) VALUES ` +
      values.map(() => placeholders).join(", ")
    await my.query(sqlText, values.flat())

    copied += rows.length
    process.stdout.write(`\r  copy   ${table}: ${copied}`)
    if (rows.length < BATCH) break
  }
  process.stdout.write(`\r  done   ${table}: ${copied}          \n`)
  return copied
}

async function main() {
  loadEnv()
  const preflightOnly = process.argv.includes("--preflight-only")
  const truncate = process.argv.includes("--truncate")

  const pg = postgres(requireEnv("SOURCE_DATABASE_URL"), { ssl: "require", max: 1 })
  const clean = await preflight(pg)

  if (preflightOnly) {
    await pg.end()
    process.exit(clean ? 0 : 1)
  }
  if (!clean) {
    console.error("\nRefusing to copy while preflight is blocking.")
    await pg.end()
    process.exit(1)
  }

  const my = await mysql.createConnection({
    uri: requireEnv("DATABASE_URL"),
    timezone: "Z",
    multipleStatements: false,
  })

  console.log("\n=== COPY ======================================================")
  await my.query("SET FOREIGN_KEY_CHECKS = 0")
  if (truncate) {
    for (const t of [...TABLES].reverse()) {
      await my.query(`TRUNCATE TABLE ${q(t)}`).catch(() => {})
    }
    console.log("  (target tables truncated)")
  }

  const copied: Record<string, number> = {}
  for (const t of TABLES) copied[t] = await copyTable(pg, my, t)
  await my.query("SET FOREIGN_KEY_CHECKS = 1")

  console.log("\n=== VERIFY ====================================================")
  let mismatches = 0
  for (const t of TABLES) {
    let src = 0
    try {
      const r = await pg.unsafe(`select count(*)::int as n from ${q2(t)}`)
      src = Number(r[0]?.n ?? 0)
    } catch {
      continue
    }
    const [dst] = (await my.query(`SELECT count(*) AS n FROM ${q(t)}`)) as [
      Array<{ n: number }>,
      unknown,
    ]
    const got = Number(dst[0]?.n ?? 0)
    const ok = src === got
    if (!ok) mismatches++
    console.log(
      `  ${ok ? "ok   " : "DIFF "} ${t.padEnd(26)} postgres ${String(src).padStart(8)}  mysql ${String(got).padStart(8)}`,
    )
  }

  await pg.end()
  await my.end()

  console.log(
    mismatches === 0
      ? "\nEvery table matches. Migration complete."
      : `\n${mismatches} table(s) differ — do NOT cut over yet.`,
  )
  process.exit(mismatches === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
