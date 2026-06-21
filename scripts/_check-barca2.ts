import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
  
  // Find Barcelona team
  const teams = await sql`select id, name, slug from teams where name ilike '%barcelona%'`
  console.log("Barcelona teams:", teams.length)
  for (const t of teams) console.log(" ", t.id, t.name, t.slug)
  
  if (teams.length > 0) {
    const tId = teams[0].id
    
    // All stats for this team
    const stats = await sql`
      select l.slug as league, s.name as season, s.is_current, count(*) as cnt
      from player_season_stats pss
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where pss.team_id = ${tId}
      group by l.slug, s.name, s.is_current
      order by s.name
    `
    console.log("\nAll stats for Barcelona:")
    for (const s of stats) console.log(" ", s.league, s.season, "current=" + s.is_current, "cnt=" + s.cnt)
    
    // Check ACB 2025-26 - does any ACB team have stats?
    const acbCurrent = await sql`
      select t.name, count(*) as cnt
      from player_season_stats pss
      join teams t on t.id = pss.team_id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'acb' and s.name = '2025-26'
      group by t.name
      order by t.name
    `
    console.log("\nACB 2025-26 teams with stats:")
    for (const s of acbCurrent) console.log(" ", s.name, s.cnt)
    
    // Check ACB team IDs
    const acbTeams = await sql`
      select distinct t.id, t.name
      from player_season_stats pss
      join teams t on t.id = pss.team_id
      join leagues l on l.id = pss.league_id
      where l.slug = 'acb'
      order by t.name
    `
    console.log("\nACB teams in DB:")
    for (const t of acbTeams) console.log(" ", t.id, t.name)
  }
  
  await sql.end()
}

main().catch(console.error)
