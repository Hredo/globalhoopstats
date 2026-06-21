import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

  // Verify Barcelona stats
  const teams = await sql`
    select id, name, slug from teams where slug = 'barcelona'
  `
  const t = teams[0]
  console.log("Barcelona:", t.id, t.name, t.slug)

  const stats = await sql`
    select l.slug as league, s.name as season, s.is_current, count(*) as cnt
    from player_season_stats pss
    join leagues l on l.id = pss.league_id
    join seasons s on s.id = pss.season_id
    where pss.team_id = ${t.id}
    group by l.slug, s.name, s.is_current
    order by s.name
  `
  console.log("\nAll stats for Barcelona:")
  for (const s of stats) console.log(" ", s.league, s.season, "current=" + s.is_current, "cnt=" + s.cnt)

  await sql.end()
}

main().catch(console.error)
