import postgres from "postgres"

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

  // 1. Get all candidate teams
  const rows = await sql`
    select id, name, slug,
      (select string_agg(distinct l.slug, ',') from player_season_stats pss join leagues l on l.id = pss.league_id where pss.team_id = t.id) as leagues,
      (select count(*) from player_season_stats pss where pss.team_id = t.id)::int as stats_count,
      (select count(*) from coaches c where c.team_id = t.id)::int as coach_count,
      (select count(*) from team_season_stats sts where sts.team_id = t.id)::int as source_stats_count
    from teams t
    where t.slug in ('barcelona', 'barca', 'baskonia', 'kosner-baskonia', 'panathinaikos', 'panathinaikos-aktor')
    order by t.slug
  `
  
  console.log("=== Duplicate teams ===")
  for (const r of rows) {
    console.log(r.id, String(r.name).padEnd(35), String(r.slug).padEnd(30), "leagues:", String(r.leagues).padEnd(20), "stats:", String(r.stats_count).padEnd(5), "coaches:", String(r.coach_count).padEnd(5), "team_stats:", String(r.source_stats_count))
  }

  // Define merge map: duplicate → canonical
  const mergeMap: Record<string, string> = {
    // duplicate slug → canonical slug
    "barca": "barcelona",
    "kosner-baskonia": "baskonia",
    "panathinaikos-aktor": "panathinaikos",
  }

  const slugToId: Record<string, string> = {}
  for (const r of rows) slugToId[r.slug] = r.id

  for (const [dupSlug, canSlug] of Object.entries(mergeMap)) {
    const dupId = slugToId[dupSlug]
    const canId = slugToId[canSlug]
    if (!dupId || !canId) {
      console.log(`\n⚠ Skipping ${dupSlug} → ${canSlug}: missing IDs`)
      continue
    }
    if (dupId === canId) {
      console.log(`\n✓ ${dupSlug} → ${canSlug}: already same row, skipping`)
      continue
    }

    console.log(`\n--- Merging ${dupSlug} → ${canSlug} ---`)

    // player_season_stats: ON CONFLICT (player_id, team_id, league_id, season_id)
    // Use a subquery approach: for rows in duplicate team, if a row with same
    // (player_id, league_id, season_id) exists on canonical team, delete the duplicate's row.
    // Otherwise, update the duplicate's team_id.

    // First, find which rows would conflict
    const conflicts = await sql`
      select pss_dup.id as dup_id
      from player_season_stats pss_dup
      left join player_season_stats pss_can 
        on pss_can.player_id = pss_dup.player_id
        and pss_can.league_id = pss_dup.league_id
        and pss_can.season_id = pss_dup.season_id
        and pss_can.team_id = ${canId}
      where pss_dup.team_id = ${dupId}
        and pss_can.id is not null
    `
    if (conflicts.length > 0) {
      const conflictIds = conflicts.map(c => c.dup_id)
      console.log(`  Deleting ${conflictIds.length} conflicting player_season_stats rows`)
      await sql`delete from player_season_stats where id = any(${conflictIds})`
    }

    // Update remaining player_season_stats to canonical team
    const pssResult = await sql`
      update player_season_stats set team_id = ${canId}
      where team_id = ${dupId}
    `
    console.log(`  Updated player_season_stats: ${pssResult.count} rows`)

    // coaches: ON CONFLICT (team_id, league_id, slug)
    const coachConflicts = await sql`
      select c_dup.id as dup_id
      from coaches c_dup
      left join coaches c_can
        on c_can.team_id = ${canId}
        and c_can.league_id = c_dup.league_id
        and c_can.slug = c_dup.slug
      where c_dup.team_id = ${dupId}
        and c_can.id is not null
    `
    if (coachConflicts.length > 0) {
      const conflictIds = coachConflicts.map(c => c.dup_id)
      console.log(`  Deleting ${conflictIds.length} conflicting coach rows`)
      await sql`delete from coaches where id = any(${conflictIds})`
    }

    const coachResult = await sql`
      update coaches set team_id = ${canId}
      where team_id = ${dupId}
    `
    console.log(`  Updated coaches: ${coachResult.count} rows`)

    // team_season_stats: ON CONFLICT (team_id, season_id, league_id)
    const stsConflicts = await sql`
      select sts_dup.id as dup_id
      from team_season_stats sts_dup
      left join team_season_stats sts_can
        on sts_can.team_id = ${canId}
        and sts_can.season_id = sts_dup.season_id
        and sts_can.league_id = sts_dup.league_id
      where sts_dup.team_id = ${dupId}
        and sts_can.id is not null
    `
    if (stsConflicts.length > 0) {
      const conflictIds = stsConflicts.map(c => c.dup_id)
      console.log(`  Deleting ${conflictIds.length} conflicting team_season_stats rows`)
      await sql`delete from team_season_stats where id = any(${conflictIds})`
    }

    const stsResult = await sql`
      update team_season_stats set team_id = ${canId}
      where team_id = ${dupId}
    `
    console.log(`  Updated team_season_stats: ${stsResult.count} rows`)

    // Delete the duplicate team
    await sql`delete from teams where id = ${dupId}`
    console.log(`  Deleted duplicate team (${dupSlug})`)
  }

  // Verify results
  console.log("\n=== Verification ===")
  const verifyRows = await sql`
    select id, name, slug,
      (select string_agg(distinct l.slug, ',') from player_season_stats pss join leagues l on l.id = pss.league_id where pss.team_id = t.id) as leagues,
      (select count(*) from player_season_stats pss where pss.team_id = t.id)::int as stats_count
    from teams t
    where t.slug in ('barcelona', 'baskonia', 'panathinaikos')
    order by t.slug
  `
  for (const r of verifyRows) {
    console.log(" ", String(r.name).padEnd(35), String(r.slug).padEnd(30), "leagues:", String(r.leagues).padEnd(20), "stats:", String(r.stats_count))
  }

  await sql.end()
  console.log("\nDone!")
}

main().catch(console.error)
