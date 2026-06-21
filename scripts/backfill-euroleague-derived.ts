/*
 * Fills EuroLeague current-season data that is derivable rather than fed:
 *  1. Shooting / rebound / foul splits still null, from Basketball-Reference
 *     totals (catches marginal players absent from the EL accumulated feed,
 *     e.g. Pleiss, Moraitis).
 *  2. true_shooting_pct, computed from pts / (2*(fga + 0.44*fta)).
 *  3. team_season_stats.sos (strength of schedule) = mean opponent win% — exact
 *     for EuroLeague's balanced double round-robin regular season.
 *
 * Only writes columns that are currently null. Usage:
 *   pnpm exec tsx scripts/backfill-euroleague-derived.ts [--dry]
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
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (!process.env[m[1]]) process.env[m[1]] = v
      }
    } catch {
      /* optional */
    }
  }
}

const DRY = process.argv.includes("--dry")
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function toNum(s: string | undefined): number | null {
  if (s === undefined || s === "") return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

type BrRow = {
  fg: number | null
  fga: number | null
  fg3: number | null
  fg3a: number | null
  ft: number | null
  fta: number | null
  orb: number | null
  drb: number | null
  pf: number | null
}

async function fetchBrTotals(): Promise<Map<string, BrRow>> {
  const url =
    "https://www.basketball-reference.com/international/euroleague/2025_totals.html"
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`BR ${res.status} ${res.statusText}`)
  const html = await res.text()
  const table =
    html.match(/<table[^>]*\bid="totals-stats-2025"[\s\S]*?<\/table>/i)?.[0] ?? ""
  const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? []
  const out = new Map<string, BrRow>()
  for (const row of rows) {
    const cells = new Map<string, string>()
    const re = /<t[hd]\b[^>]*\bdata-stat="([^"]+)"[^>]*>([\s\S]*?)<\/t[hd]>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(row)) !== null) {
      cells.set(m[1], decodeEntities(m[2].replace(/<[^>]+>/g, "").trim()))
    }
    const name = cells.get("player")
    if (!name) continue
    out.set(norm(name), {
      fg: toNum(cells.get("fg")),
      fga: toNum(cells.get("fga")),
      fg3: toNum(cells.get("fg3")),
      fg3a: toNum(cells.get("fg3a")),
      ft: toNum(cells.get("ft")),
      fta: toNum(cells.get("fta")),
      orb: toNum(cells.get("orb")),
      drb: toNum(cells.get("drb")),
      pf: toNum(cells.get("pf")),
    })
  }
  return out
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    /* ---------- 1. shooting/reb/foul splits from BR ---------- */
    const br = await fetchBrTotals()
    console.log(`[br] ${br.size} totals rows`)
    const statRows = await sql<
      {
        id: string
        name: string
        fg_made: number | null
        fg_attempted: number | null
        three_made: number | null
        three_attempted: number | null
        ft_made: number | null
        ft_attempted: number | null
        offensive_rebounds: number | null
        defensive_rebounds: number | null
        fouls_total: number | null
      }[]
    >`
      select pss.id, p.first_name || ' ' || p.last_name as name,
        pss.fg_made, pss.fg_attempted, pss.three_made, pss.three_attempted,
        pss.ft_made, pss.ft_attempted, pss.offensive_rebounds,
        pss.defensive_rebounds, pss.fouls_total
      from player_season_stats pss
      join players p on p.id = pss.player_id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
        and (pss.fg_made is null or pss.fg_attempted is null
          or pss.three_made is null or pss.three_attempted is null
          or pss.ft_made is null or pss.ft_attempted is null
          or pss.offensive_rebounds is null or pss.defensive_rebounds is null
          or pss.fouls_total is null)
    `
    console.log(`[splits] ${statRows.length} rows with null splits`)
    let splitsUpdated = 0
    for (const r of statRows) {
      const b = br.get(norm(r.name))
      if (!b) {
        console.warn(`  [splits] no BR row for ${r.name}`)
        continue
      }
      const fills: Record<string, number> = {}
      const set = (col: string, cur: number | null, val: number | null) => {
        if (cur == null && val != null) fills[col] = val
      }
      set("fg_made", r.fg_made, b.fg)
      set("fg_attempted", r.fg_attempted, b.fga)
      set("three_made", r.three_made, b.fg3)
      set("three_attempted", r.three_attempted, b.fg3a)
      set("ft_made", r.ft_made, b.ft)
      set("ft_attempted", r.ft_attempted, b.fta)
      set("offensive_rebounds", r.offensive_rebounds, b.orb)
      set("defensive_rebounds", r.defensive_rebounds, b.drb)
      set("fouls_total", r.fouls_total, b.pf)
      if (Object.keys(fills).length === 0) continue
      if (DRY) {
        console.log(`  [dry] ${r.name}: ${Object.keys(fills).join(",")}`)
      } else {
        await sql`update player_season_stats set ${sql(fills)} where id = ${r.id}`
        splitsUpdated++
        console.log(`  ${r.name}: ${Object.keys(fills).join(",")}`)
      }
    }
    console.log(`[splits] updated=${splitsUpdated}`)

    /* ---------- 2. true_shooting_pct ---------- */
    const tsRows = await sql<
      {
        id: string
        points_total: number | null
        fg_attempted: number | null
        ft_attempted: number | null
      }[]
    >`
      select pss.id, pss.points_total, pss.fg_attempted, pss.ft_attempted
      from player_season_stats pss
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
        and pss.true_shooting_pct is null
    `
    console.log(`\n[ts] ${tsRows.length} rows with null true_shooting_pct`)
    let tsUpdated = 0
    for (const r of tsRows) {
      const fga = r.fg_attempted ?? 0
      const fta = r.ft_attempted ?? 0
      const pts = r.points_total ?? 0
      const denom = 2 * (fga + 0.44 * fta)
      // No shot attempts at all -> TS undefined; 0.0 is the standard convention.
      const ts = denom > 0 ? Number((pts / denom).toFixed(3)) : 0
      if (DRY) {
        console.log(`  [dry] ts=${ts} (pts=${pts} fga=${fga} fta=${fta})`)
      } else {
        await sql`update player_season_stats set true_shooting_pct = ${ts} where id = ${r.id}`
        tsUpdated++
      }
    }
    console.log(`[ts] updated=${tsUpdated}`)

    /* ---------- 3. team_season_stats.sos ---------- */
    const teamRows = await sql<
      {
        id: number
        wins: number
        losses: number
        win_pct: number | null
        sos: number | null
      }[]
    >`
      select tss.id, tss.wins, tss.losses, tss.win_pct, tss.sos
      from team_season_stats tss
      join leagues l on l.id = tss.league_id
      join seasons s on s.id = tss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    const pcts = teamRows.map((t) => {
      const gp = t.wins + t.losses
      return t.win_pct ?? (gp > 0 ? t.wins / gp : 0)
    })
    const total = pcts.reduce((a, b) => a + b, 0)
    console.log(`\n[sos] ${teamRows.length} EL teams`)
    let sosUpdated = 0
    for (let i = 0; i < teamRows.length; i++) {
      if (teamRows[i].sos != null) continue
      // Mean win% of every OTHER team (balanced double round-robin).
      const others = teamRows.length - 1
      const sos = others > 0 ? Number(((total - pcts[i]) / others).toFixed(3)) : 0
      if (DRY) {
        console.log(`  [dry] team ${teamRows[i].id}: sos=${sos}`)
      } else {
        await sql`update team_season_stats set sos = ${sos} where id = ${teamRows[i].id}`
        sosUpdated++
      }
    }
    console.log(`[sos] updated=${sosUpdated}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("DERIVED BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
