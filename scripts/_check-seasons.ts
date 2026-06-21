import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
  const seasons = await sql`
    select s.id, s.name, s.is_current,
      (select count(*) from player_season_stats pss where pss.season_id = s.id) as stat_count
    from seasons s
    order by s.name
  `
  console.log("Seasons:")
  for (const s of seasons) console.log(" ", s.name, "current=" + s.is_current, "stats=" + s.stat_count)

  const leagues = await sql`select slug, name from leagues order by slug`
  console.log("\nLeagues:")
  for (const l of leagues) console.log(" ", l.slug, l.name)

  // Check what seasons ACB stats use
  const acbSeasons = await sql`
    select s.name, count(*) as cnt
    from player_season_stats pss
    join leagues l on l.id = pss.league_id
    join seasons s on s.id = pss.season_id
    where l.slug = 'acb'
    group by s.name
    order by s.name
  `
  console.log("\nACB stat seasons:")
  for (const s of acbSeasons) console.log(" ", s.name, s.cnt)

  // Check what seasons EL stats use
  const elSeasons = await sql`
    select s.name, count(*) as cnt
    from player_season_stats pss
    join leagues l on l.id = pss.league_id
    join seasons s on s.id = pss.season_id
    where l.slug = 'euroleague'
    group by s.name
    order by s.name
  `
  console.log("\nEL stat seasons:")
  for (const s of elSeasons) console.log(" ", s.name, s.cnt)

  await sql.end()
}

main().catch(console.error)
