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
  for (const league of ["acb", "euroleague", "nba"]) {
    console.log(`\n=== ${league.toUpperCase()} ===`)
    const total = (await sql.unsafe(`select count(*) as c from player_season_stats pss join leagues l on l.id = pss.league_id where l.slug='${league}'`))[0].c
    const fields = [
      "true_shooting_pct", "fg_made", "fg_attempted",
      "three_made", "three_attempted", "ft_made", "ft_attempted",
      "points_total", "minutes_total", "games_played"
    ]
    for (const f of fields) {
      const r = await sql.unsafe(`select count(*) as c from player_season_stats pss join leagues l on l.id = pss.league_id where l.slug='${league}' and pss.${f} is null`)
      console.log(`  ${f} null: ${r[0].c} / ${total}`)
    }
    // Sample rows
    const r = await sql.unsafe(`select p.first_name || ' ' || p.last_name as name, pss.true_shooting_pct, pss.fg_made, pss.fg_attempted, pss.three_made, pss.three_attempted, pss.ft_made, pss.ft_attempted, pss.games_played, pss.points_total from player_season_stats pss join players p on p.id = pss.player_id join leagues l on l.id = pss.league_id where l.slug='${league}' limit 5`)
    console.log(`  Sample:`, JSON.stringify(r, null, 4))
  }
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
