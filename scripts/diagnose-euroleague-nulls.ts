/*
 * Read-only diagnostic: counts NULL values per column for EuroLeague's current
 * season across players, player_season_stats, teams, coaches and team_season_stats.
 * Usage: pnpm exec tsx scripts/diagnose-euroleague-nulls.ts
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

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    // Discover real columns (schema.ts may lag behind migrations).
    const colsFor = async (table: string): Promise<string[]> => {
      const rows = await sql<{ column_name: string }[]>`
        select column_name from information_schema.columns
        where table_name = ${table} order by ordinal_position
      `
      return rows.map((r) => r.column_name)
    }

    /* ---- players (current EL season) ---- */
    const playerCols = await colsFor("players")
    const [{ total: playerTotal }] = await sql<{ total: number }[]>`
      select count(distinct p.id)::int as total
      from players p
      join player_season_stats pss on pss.player_id = p.id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    console.log(`\n=== PLAYERS (EL current season): ${playerTotal} ===`)
    for (const col of playerCols) {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(distinct p.id)::int as n
        from players p
        join player_season_stats pss on pss.player_id = p.id
        join leagues l on l.id = pss.league_id
        join seasons s on s.id = pss.season_id
        where l.slug = 'euroleague' and s.is_current
          and ${sql(`p.${col}`)} is null
      `
      if (n > 0) console.log(`  ${col.padEnd(20)} null: ${n}`)
    }

    /* ---- player_season_stats (current EL season) ---- */
    const statCols = await colsFor("player_season_stats")
    const [{ total: statTotal }] = await sql<{ total: number }[]>`
      select count(*)::int as total
      from player_season_stats pss
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    console.log(`\n=== PLAYER_SEASON_STATS (EL current season): ${statTotal} rows ===`)
    for (const col of statCols) {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n
        from player_season_stats pss
        join leagues l on l.id = pss.league_id
        join seasons s on s.id = pss.season_id
        where l.slug = 'euroleague' and s.is_current
          and ${sql(`pss.${col}`)} is null
      `
      if (n > 0) console.log(`  ${col.padEnd(24)} null: ${n}`)
    }

    /* ---- teams (any EL team) ---- */
    const teamCols = await colsFor("teams")
    const [{ total: teamTotal }] = await sql<{ total: number }[]>`
      select count(distinct t.id)::int as total
      from teams t
      join player_season_stats pss on pss.team_id = t.id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    console.log(`\n=== TEAMS (EL current season): ${teamTotal} ===`)
    for (const col of teamCols) {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(distinct t.id)::int as n
        from teams t
        join player_season_stats pss on pss.team_id = t.id
        join leagues l on l.id = pss.league_id
        join seasons s on s.id = pss.season_id
        where l.slug = 'euroleague' and s.is_current
          and ${sql(`t.${col}`)} is null
      `
      if (n > 0) console.log(`  ${col.padEnd(20)} null: ${n}`)
    }

    /* ---- coaches (EL) ---- */
    const coachCols = await colsFor("coaches")
    const [{ total: coachTotal }] = await sql<{ total: number }[]>`
      select count(*)::int as total
      from coaches c
      join leagues l on l.id = c.league_id
      where l.slug = 'euroleague'
    `
    console.log(`\n=== COACHES (EL): ${coachTotal} ===`)
    for (const col of coachCols) {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n
        from coaches c
        join leagues l on l.id = c.league_id
        where l.slug = 'euroleague' and ${sql(`c.${col}`)} is null
      `
      if (n > 0) console.log(`  ${col.padEnd(20)} null: ${n}`)
    }

    /* ---- team_season_stats (EL current season) ---- */
    const tssCols = await colsFor("team_season_stats")
    const [{ total: tssTotal }] = await sql<{ total: number }[]>`
      select count(*)::int as total
      from team_season_stats tss
      join leagues l on l.id = tss.league_id
      join seasons s on s.id = tss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    console.log(`\n=== TEAM_SEASON_STATS (EL current season): ${tssTotal} rows ===`)
    for (const col of tssCols) {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n
        from team_season_stats tss
        join leagues l on l.id = tss.league_id
        join seasons s on s.id = tss.season_id
        where l.slug = 'euroleague' and s.is_current
          and ${sql(`tss.${col}`)} is null
      `
      if (n > 0) console.log(`  ${col.padEnd(20)} null: ${n}`)
    }

    console.log("\nDone.")
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("DIAGNOSE FAILED:", e?.message ?? e)
  process.exit(1)
})
