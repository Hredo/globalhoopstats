import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

  // Find all teams that might be duplicates of each other
  const rows = await sql`
    select id, name, slug,
      (select string_agg(distinct l.slug, ',') from player_season_stats pss join leagues l on l.id = pss.league_id where pss.team_id = t.id) as leagues,
      (select count(*) from player_season_stats pss where pss.team_id = t.id) as stats_count,
      (select count(*) from coach_season_stats css where css.team_id = t.id) as coach_count,
      (select count(*) from source_team_stats sts where sts.team_id = t.id) as source_stats_count
    from teams t
    where t.slug in ('barcelona', 'barca', 'baskonia', 'kosner-baskonia', 'panathinaikos', 'panathinaikos-aktor')
    order by t.slug
  `
  
  for (const r of rows) {
    console.log(r.id, r.name?.padEnd(35), r.slug?.padEnd(30), "leagues:", r.leagues?.padEnd(20), "stats:", String(r.stats_count).padEnd(5), "coaches:", String(r.coach_count).padEnd(5), "source_stats:", String(r.source_stats_count).padEnd(5))
  }

  // Also check what's in source_team_stats for Barcelona/Barça
  console.log("\n--- Source team stats for these teams ---")
  const sts = await sql`
    select sts.team_id, t.name, t.slug, l.slug as league, sts.season
    from source_team_stats sts
    join teams t on t.id = sts.team_id
    join leagues l on l.id = sts.league_id
    where t.slug in ('barcelona', 'barca', 'baskonia', 'kosner-baskonia', 'panathinaikos', 'panathinaikos-aktor')
    order by t.slug, sts.season
  `
  for (const s of sts) {
    console.log(" ", s.team_id, String(s.name).padEnd(20), String(s.slug).padEnd(25), String(s.league).padEnd(10), s.season)
  }

  await sql.end()
}

main().catch(console.error)
