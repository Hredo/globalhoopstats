import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

  // Find potential duplicate teams (same club, different name/slug)
  const teams = await sql`
    select t.id, t.name, t.slug, 
      (select string_agg(distinct l.slug, ',') from player_season_stats pss join leagues l on l.id = pss.league_id where pss.team_id = t.id) as leagues,
      (select count(*) from player_season_stats pss where pss.team_id = t.id) as total_stats
    from teams t
    order by t.name
  `
  console.log("All teams:")
  for (const t of teams) {
    if (t.total_stats > 0) console.log(" ", t.name?.padEnd(35), t.slug?.padEnd(30), t.leagues?.padEnd(20), t.total_stats)
  }

  // Find teams with 0 stats (orphaned)
  const orphans = await sql`
    select t.id, t.name, t.slug from teams t
    where not exists (select 1 from player_season_stats pss where pss.team_id = t.id)
    order by t.name
  `
  console.log("\nOrphaned teams (0 stats):")
  for (const t of orphans) console.log(" ", t.name, t.slug)

  await sql.end()
}

main().catch(console.error)
