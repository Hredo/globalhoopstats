import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
  const teams = await sql`select id, name, slug from teams where name ilike '%barcelona%'`
  console.log("Teams:", teams.length)
  for (const t of teams) console.log(" ", t.id, t.name, t.slug)

  // Check if Barcelona has player_season_stats
  const stats = await sql`
    select pss.team_id, t.name as team_name, l.slug as league_slug, s.name as season_name, s.is_current, count(*) as cnt
    from player_season_stats pss
    join teams t on t.id = pss.team_id
    join leagues l on l.id = pss.league_id
    join seasons s on s.id = pss.season_id
    where t.name ilike '%barcelona%'
    group by pss.team_id, t.name, l.slug, s.name, s.is_current
    order by s.name
  `
  console.log("Barcelona stats:")
  for (const s of stats) console.log(" ", s.team_name, s.league_slug, s.season_name, "current=" + s.is_current, "cnt=" + s.cnt)

  // Check what getTeamBySlug returns
  const teamRow = teams[0]
  if (teamRow) {
    const playerCount = await sql`
      select count(distinct p.player_id) as cnt
      from player_season_stats p
      inner join seasons s on s.id = p.season_id and s.is_current
      where p.team_id = ${teamRow.id}
    `
    console.log("Player count (current season):", playerCount[0]?.cnt)
  }

  await sql.end()
}

main().catch(console.error)
