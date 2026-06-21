/*
 * Read-only: inspect duplicate / empty player records. Focus on a surname via
 * arg, else scan for near-dupes by folded surname where one record is "empty".
 *   pnpm exec tsx scripts/_diag-dupe-players.ts campazzo
 *   pnpm exec tsx scripts/_diag-dupe-players.ts
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
    } catch { /* optional */ }
  }
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

async function main() {
  loadEnv()
  const arg = process.argv[2]?.toLowerCase()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    const rows = await sql<{
      id: string; first_name: string; last_name: string; slug: string
      bio: string | null; image_url: string | null; nationality: string | null
      position: string | null; height_cm: number | null
      stat_rows: number; total_games: number; leagues: string | null; seasons: string | null
    }[]>`
      select p.id, p.first_name, p.last_name, p.slug, p.bio, p.image_url,
        p.nationality, p.position, p.height_cm,
        count(pss.id)::int as stat_rows,
        coalesce(sum(pss.games_played),0)::int as total_games,
        string_agg(distinct l.slug, ',') as leagues,
        string_agg(distinct s.name, ',') as seasons
      from players p
      left join player_season_stats pss on pss.player_id = p.id
      left join leagues l on l.id = pss.league_id
      left join seasons s on s.id = pss.season_id
      group by p.id
    `

    type R = (typeof rows)[number]
    const emptyScore = (r: R) =>
      (r.bio ? 1 : 0) + (r.image_url ? 1 : 0) + (r.nationality ? 1 : 0) + (r.position ? 1 : 0) + (r.height_cm ? 1 : 0)
    const show = (r: R) =>
      `  ${r.first_name} ${r.last_name}`.padEnd(32) +
      ` slug=${(r.slug ?? "").padEnd(28)} stats=${String(r.stat_rows).padStart(2)} games=${String(r.total_games).padStart(3)}` +
      ` lg=${(r.leagues ?? "-").padEnd(20)} bio/img/nat/pos/h=${emptyScore(r)}/5  seasons=${r.seasons ?? "-"}`

    if (arg === "suffix") {
      // Precise signature: slug ends in -<n>, and the base slug exists too.
      const bySlug = new Map(rows.map((r) => [r.slug, r]))
      const pairs: Array<{ base: R; suf: R; n: number }> = []
      for (const r of rows) {
        const m = r.slug?.match(/^(.*)-(\d+)$/)
        if (!m) continue
        const base = bySlug.get(m[1])
        if (base) pairs.push({ base, suf: r, n: Number(m[2]) })
      }
      console.log(`\n=== slug-suffix duplicate pairs: ${pairs.length} ===`)
      for (const { base, suf } of pairs.sort((a, b) => b.suf.total_games - a.suf.total_games)) {
        const sameName = fold(`${base.first_name} ${base.last_name}`) !== fold(`${suf.first_name} ${suf.last_name}`)
          ? "  ⚠ NAME DIFFERS" : ""
        console.log(`\n[${suf.slug}]${sameName}`)
        console.log(" base", show(base).trim())
        console.log(" suf ", show(suf).trim())
      }
      return
    }

    if (arg === "near") {
      // Same folded surname + one first name is a strict prefix of the other
      // (Facu/Facundo) OR identical full name. Both must have >=1 stat row so
      // they actually surface in the list. Prefix-only avoids the Jones noise.
      const withStats = rows.filter((r) => r.stat_rows > 0)
      const bySurname = new Map<string, R[]>()
      for (const r of withStats) {
        const k = fold(r.last_name)
        if (k.length < 3) continue
        const g = bySurname.get(k) ?? []
        g.push(r)
        bySurname.set(k, g)
      }
      const pairs: Array<[R, R]> = []
      for (const g of bySurname.values()) {
        for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
          const fa = fold(g[i].first_name), fb = fold(g[j].first_name)
          if (!fa || !fb) continue
          const prefix = fa !== fb && (fa.startsWith(fb) || fb.startsWith(fa))
          const sameFull = fold(`${g[i].first_name} ${g[i].last_name}`) === fold(`${g[j].first_name} ${g[j].last_name}`)
          if (prefix || sameFull) pairs.push([g[i], g[j]])
        }
      }
      console.log(`\n=== prefix/same near-duplicate pairs (both have stats): ${pairs.length} ===`)
      for (const [a, b] of pairs.sort((x, y) => y[0].total_games - x[0].total_games)) {
        const aw = a.total_games >= b.total_games ? a : b
        const lo = aw === a ? b : a
        console.log(`\n[${fold(a.last_name)}] same-league=${(aw.leagues ?? "").split(",").some((l) => (lo.leagues ?? "").split(",").includes(l))}`)
        console.log(" keep", show(aw).trim())
        console.log(" drop", show(lo).trim())
      }
      return
    }

    if (arg) {
      const hits = rows.filter((r) => fold(r.last_name).includes(arg) || fold(`${r.first_name} ${r.last_name}`).includes(arg))
      console.log(`\n=== records matching "${arg}": ${hits.length} ===`)
      for (const r of hits.sort((a, b) => b.total_games - a.total_games)) console.log(show(r), "\n   id=" + r.id)
      return
    }

    // Orphans: a player with NO stat rows at all (invisible to the list, but a true dangling row).
    const orphans = rows.filter((r) => r.stat_rows === 0)
    console.log(`\n=== ORPHAN players (0 stat rows): ${orphans.length} ===`)
    for (const r of orphans.slice(0, 50)) console.log(show(r))

    // Near-dupes: same folded surname, 2+ records, at least one "empty-ish" (emptyScore <= 1).
    const bySurname = new Map<string, R[]>()
    for (const r of rows) {
      const k = fold(r.last_name)
      if (k.length < 3) continue
      const g = bySurname.get(k) ?? []
      g.push(r)
      bySurname.set(k, g)
    }
    const suspect = [...bySurname.entries()]
      .filter(([, g]) => g.length > 1 && g.some((r) => emptyScore(r) <= 1))
      .sort((a, b) => b[1].length - a[1].length)
    console.log(`\n=== surname groups with 2+ records & an empty-ish one: ${suspect.length} ===`)
    for (const [k, g] of suspect.slice(0, 60)) {
      console.log(`\n[${k}] ${g.length} records`)
      for (const r of g.sort((a, b) => b.total_games - a.total_games)) console.log(show(r))
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => { console.error("DIAG FAILED:", e?.message ?? e); process.exit(1) })
