/*
 * Cross-league null sweep for current-season player_season_stats. Fills every
 * column that can be filled HONESTLY — no fabricated numbers:
 *   1. Counting-stat nulls (3P, FT, blocks, steals, assists, o/d-reb, fouls,
 *      points, rebounds) → 0 for players who logged games. A null here means the
 *      box score recorded none of that action.
 *   2. fg_made / fg_attempted → 0 only for NON-scorers (points = 0); a scorer
 *      with null FG is a genuine data gap and is left + reported, never zeroed.
 *   3. defensive_rebounds = total − offensive when only the split is missing.
 *   4. true_shooting_pct = pts / (2*(fga + 0.44*fta)), exact, computed last so it
 *      benefits from the zero-fills above.
 *
 * Advanced metrics (per, win_shares, bpm, plus_minus) are NOT touched: no source
 * publishes them for EuroLeague / ACB / FEB, so they stay null rather than faked.
 *
 * Usage: pnpm exec tsx scripts/backfill-null-stats.ts [--dry]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8")
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (!m) continue
        let v = m[2].trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (!process.env[m[1]]) process.env[m[1]] = v
      }
    } catch {
      /* file may not exist */
    }
  }
}

const DRY = process.argv.includes("--dry")

// Counting stats where a null means "none recorded" → 0 (played rows only).
const ZERO_COLS = [
  "three_made", "three_attempted", "ft_made", "ft_attempted",
  "blocks_total", "steals_total", "assists_total",
  "offensive_rebounds", "fouls_total", "points_total", "rebounds_total",
]

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  const scope = sql`
    from player_season_stats pss
    where pss.season_id in (select id from seasons where is_current)
      and pss.games_played > 0`

  try {
    // Pre-count nulls so we can report the reduction.
    const before = await sql<Record<string, number>[]>`
      select
        count(*) filter (where three_made is null) three_made,
        count(*) filter (where ft_made is null) ft_made,
        count(*) filter (where blocks_total is null) blocks_total,
        count(*) filter (where steals_total is null) steals_total,
        count(*) filter (where assists_total is null) assists_total,
        count(*) filter (where offensive_rebounds is null) offensive_rebounds,
        count(*) filter (where defensive_rebounds is null) defensive_rebounds,
        count(*) filter (where fouls_total is null) fouls_total,
        count(*) filter (where fg_made is null) fg_made,
        count(*) filter (where true_shooting_pct is null) true_shooting_pct
      ${scope}`
    console.log("[before]", before[0])

    // Scorers with a genuine FG gap — reported, never zeroed.
    const [fgGap] = await sql<{ n: number }[]>`
      select count(*)::int n ${scope} and fg_made is null and coalesce(points_total,0) > 0`
    console.log(`[fg gap] scorers with null FG (left as-is): ${fgGap.n}`)

    if (DRY) {
      console.log("[dry] no writes")
      return
    }

    // 1. counting-stat zero-fills
    for (const col of ZERO_COLS) {
      const r = await sql`
        update player_season_stats set ${sql(col)} = 0
        where season_id in (select id from seasons where is_current)
          and games_played > 0 and ${sql(col)} is null`
      if (r.count > 0) console.log(`  ${col} → 0 : ${r.count} rows`)
    }
    // 2. fg only for non-scorers (after points zero-fill above)
    for (const col of ["fg_made", "fg_attempted"]) {
      const r = await sql`
        update player_season_stats set ${sql(col)} = 0
        where season_id in (select id from seasons where is_current)
          and games_played > 0 and ${sql(col)} is null and coalesce(points_total,0) = 0`
      if (r.count > 0) console.log(`  ${col} → 0 (non-scorers) : ${r.count} rows`)
    }
    // 3. defensive rebounds from the split, then any residual → 0
    const dreb = await sql`
      update player_season_stats
        set defensive_rebounds = greatest(coalesce(rebounds_total,0) - coalesce(offensive_rebounds,0), 0)
      where season_id in (select id from seasons where is_current)
        and games_played > 0 and defensive_rebounds is null and rebounds_total is not null`
    if (dreb.count > 0) console.log(`  defensive_rebounds ← total-oreb : ${dreb.count} rows`)
    const dreb0 = await sql`
      update player_season_stats set defensive_rebounds = 0
      where season_id in (select id from seasons where is_current)
        and games_played > 0 and defensive_rebounds is null`
    if (dreb0.count > 0) console.log(`  defensive_rebounds → 0 : ${dreb0.count} rows`)
    // 4. true shooting %, exact, last
    const ts = await sql`
      update player_season_stats
        set true_shooting_pct = round((points_total::numeric / (2 * (fg_attempted + 0.44 * coalesce(ft_attempted,0)))), 3)
      where season_id in (select id from seasons where is_current)
        and games_played > 0 and true_shooting_pct is null
        and points_total is not null and fg_attempted is not null
        and (fg_attempted + 0.44 * coalesce(ft_attempted,0)) > 0`
    if (ts.count > 0) console.log(`  true_shooting_pct computed : ${ts.count} rows`)

    const after = await sql<Record<string, number>[]>`
      select
        count(*) filter (where three_made is null) three_made,
        count(*) filter (where ft_made is null) ft_made,
        count(*) filter (where blocks_total is null) blocks_total,
        count(*) filter (where fg_made is null) fg_made,
        count(*) filter (where defensive_rebounds is null) defensive_rebounds,
        count(*) filter (where true_shooting_pct is null) true_shooting_pct
      ${scope}`
    console.log("[after]", after[0])
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("NULL BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
