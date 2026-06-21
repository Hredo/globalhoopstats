import postgres from "postgres"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve, dirname } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(resolve(__dirname, "..", ".env"), "utf8")
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[m[1]] = v
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false })

async function main() {
  // Step 1: Delete rows with games_played=0 and points=0 (orphaned)
  const r1 = await sql.unsafe(`
    delete from player_season_stats
    where games_played = 0 and points_total = 0 and minutes_total = 0
  `)
  console.log(`Deleted zero-stat rows: ${r1.count}`)

  // Step 2: For each league, keep only the most recent row per (player_id, team_id, league_id, season_id)
  const leagues = ["nba", "acb", "euroleague", "leb-oro", "leb-plata", "eba"]
  for (const league of leagues) {
    const before = (await sql.unsafe(`select count(*) as c from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug=$1`, [league]))[0].c

    // Delete duplicates keeping newest row per unique combo
    await sql.unsafe(`
      delete from player_season_stats
      where (player_id, team_id, league_id, season_id, created_at, id) in (
        select player_id, team_id, league_id, season_id, created_at, id
        from (
          select pss.id, pss.player_id, pss.team_id, pss.league_id, pss.season_id, pss.created_at,
            row_number() over (
              partition by pss.player_id, pss.team_id, pss.league_id, pss.season_id
              order by pss.created_at desc, pss.id desc
            ) as rn
          from player_season_stats pss
          join leagues l on l.id = pss.league_id and l.slug = $1
        ) ranked
        where ranked.rn > 1
      )
    `, [league])

    const after = (await sql.unsafe(`select count(*) as c from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug=$1`, [league]))[0].c
    if (before !== after) {
      console.log(`${league}: ${before} → ${after} (removed ${before - after})`)
    } else {
      console.log(`${league}: ${after} rows (no duplicates)`)
    }
  }

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
