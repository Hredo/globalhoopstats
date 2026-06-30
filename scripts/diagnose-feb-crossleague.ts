/*
 * READ-ONLY diagnostic for the multi-league name-collision problem.
 *
 * Domain rule (owner): a player who appears in a FEB league (Primera FEB, Segunda FEB,
 * EBA) cannot ALSO legitimately be a top-tier player (ACB / EuroLeague / NBA) in
 * this dataset. When a record carries BOTH, it is almost always two DIFFERENT
 * people that a loose name+surname dedupe collapsed into one.
 *
 * This script does NOT modify anything. It reports:
 *   1. the league slugs present and how they map to tiers,
 *   2. how many correlation signals (birthdate, nationality, height...) exist,
 *   3. every player carrying both a FEB and a non-FEB stat row (the suspects),
 *      with the signals that would let us judge same-vs-different person.
 *
 * Usage: pnpm exec tsx scripts/diagnose-feb-crossleague.ts
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
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        if (!process.env[m[1]]) process.env[m[1]] = v
      }
    } catch {
      /* optional */
    }
  }
}

// FEB = Spanish lower divisions. Everything else is "top tier" for this rule.
const FEB = new Set(["leb-oro", "leb-plata", "eba"])

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    // 1. League inventory.
    const leagues = await sql<{ slug: string; name: string; players: number }[]>`
      select l.slug, l.name, count(distinct pss.player_id)::int as players
      from leagues l
      left join player_season_stats pss on pss.league_id = l.id
      group by l.slug, l.name
      order by players desc
    `
    console.log("=== LEAGUES ===")
    for (const l of leagues) {
      const tier = FEB.has(l.slug) ? "FEB" : "TOP"
      console.log(`  [${tier}] ${l.slug.padEnd(14)} ${String(l.players).padStart(5)} players  (${l.name})`)
    }
    const unknownFeb = leagues.filter((l) => !FEB.has(l.slug) && /feb|leb|eba|liga|oro|plata/i.test(`${l.slug} ${l.name}`))
    if (unknownFeb.length) {
      console.log("  ! possibly-FEB leagues NOT in the FEB set — review:")
      for (const l of unknownFeb) console.log(`      ${l.slug} (${l.name})`)
    }

    // 2. Signal coverage on players.
    const cov = await sql<{ total: number; with_bd: number; with_nat: number; with_h: number; with_img: number }[]>`
      select count(*)::int total,
        count(birthdate)::int with_bd,
        count(nationality)::int with_nat,
        count(height_cm)::int with_h,
        count(image_url)::int with_img
      from players
    `
    const c = cov[0]
    console.log("\n=== SIGNAL COVERAGE (correlation features) ===")
    console.log(`  players total : ${c.total}`)
    console.log(`  birthdate     : ${c.with_bd}  (${((100 * c.with_bd) / c.total).toFixed(1)}%)  <- strongest same-person signal`)
    console.log(`  nationality   : ${c.with_nat}  (${((100 * c.with_nat) / c.total).toFixed(1)}%)`)
    console.log(`  height_cm     : ${c.with_h}  (${((100 * c.with_h) / c.total).toFixed(1)}%)`)
    console.log(`  image_url     : ${c.with_img}  (${((100 * c.with_img) / c.total).toFixed(1)}%)`)

    // 3. Suspects: one player_id with both FEB and non-FEB stat rows.
    type Row = {
      id: string; slug: string; first_name: string; last_name: string
      birthdate: string | null; nationality: string | null; height_cm: number | null
      league_slug: string; team_name: string | null; season_name: string; games: number | null
    }
    const rows = await sql<Row[]>`
      select p.id, p.slug, p.first_name, p.last_name, p.birthdate, p.nationality, p.height_cm,
        l.slug as league_slug, t.name as team_name, s.name as season_name, pss.games_played as games
      from players p
      join player_season_stats pss on pss.player_id = p.id
      join leagues l on l.id = pss.league_id
      left join teams t on t.id = pss.team_id
      join seasons s on s.id = pss.season_id
    `
    const byPlayer = new Map<string, { p: Row; feb: Row[]; top: Row[] }>()
    for (const r of rows) {
      let e = byPlayer.get(r.id)
      if (!e) { e = { p: r, feb: [], top: [] }; byPlayer.set(r.id, e) }
      ;(FEB.has(r.league_slug) ? e.feb : e.top).push(r)
    }
    const suspects = [...byPlayer.values()].filter((e) => e.feb.length && e.top.length)
    suspects.sort((a, b) => `${a.p.last_name}${a.p.first_name}`.localeCompare(`${b.p.last_name}${b.p.first_name}`))

    console.log(`\n=== SUSPECTS: ${suspects.length} player record(s) carry BOTH FEB and top-tier stats ===`)
    for (const e of suspects) {
      const name = `${e.p.first_name} ${e.p.last_name}`
      const bd = e.p.birthdate ?? "—"
      const nat = e.p.nationality ?? "—"
      const h = e.p.height_cm ?? "—"
      console.log(`\n  ${name}  [${e.p.slug}]  bd=${bd} nat=${nat} h=${h}`)
      const fmt = (r: (typeof rows)[number]) =>
        `      ${r.league_slug.padEnd(12)} ${(r.team_name ?? "?").padEnd(24)} ${r.season_name}  g=${r.games ?? 0}`
      console.log("    TOP:")
      for (const r of e.top.sort((a, b) => a.season_name.localeCompare(b.season_name))) console.log(fmt(r))
      console.log("    FEB:")
      for (const r of e.feb.sort((a, b) => a.season_name.localeCompare(b.season_name))) console.log(fmt(r))
    }

    console.log(`\n=== SUMMARY ===`)
    console.log(`  total players            : ${c.total}`)
    console.log(`  FEB+TOP suspect records  : ${suspects.length}`)
    console.log(`  birthdate coverage       : ${((100 * c.with_bd) / c.total).toFixed(1)}%`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("DIAGNOSE FAILED:", e?.message ?? e)
  process.exit(1)
})
