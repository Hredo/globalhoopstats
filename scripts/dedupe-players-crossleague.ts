/*
 * Merges cross-league duplicate player records the accent-fold pass misses
 * because the FIRST NAME differs by nickname/legal form (e.g. "Facu Campazzo"
 * [euroleague] vs "Facundo Campazzo" [acb] — same Real Madrid; "Nate" vs
 * "Nathan" Reuvers). Heuristic, deliberately strict to avoid merging same-name
 * relatives/teammates (LeBron/Bronny James, the Antetokounmpo brothers):
 *   1. share a team, 2. same accent-folded surname, 3. their stat rows live in
 *   DISJOINT leagues (a real split is one record per league feed; brothers
 *   share a league), 4. first names are compatible (one is a prefix of the
 *   other, or they share the first 3 letters).
 * Disjoint leagues => no (team,league,season) collisions, so rows just move.
 * Destructive — preview first:
 *   pnpm exec tsx scripts/dedupe-players-crossleague.ts --dry
 *   pnpm exec tsx scripts/dedupe-players-crossleague.ts
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
// FEB feeder divisions never share a person with the top tier (see
// src/lib/leagues-tier.ts) — even when a club name like "Baskonia" exists in
// both ACB and EBA and thus resolves to one shared team row.
const FEB = new Set(["leb-oro", "leb-plata", "eba"])
const hasFeb = (leagues: Set<string>) => [...leagues].some((l) => FEB.has(l))
const hasTop = (leagues: Set<string>) => [...leagues].some((l) => !FEB.has(l))
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

function firstNameCompatible(a: string, b: string): boolean {
  const fa = fold(a)
  const fb = fold(b)
  if (!fa || !fb) return false
  if (fa === fb) return true
  if (fa.startsWith(fb) || fb.startsWith(fa)) return true // facu / facundo
  if (fa.length >= 3 && fb.length >= 3 && fa.slice(0, 3) === fb.slice(0, 3)) return true // nate / nathan
  return false
}

type Rec = {
  id: string
  slug: string
  firstName: string
  lastName: string
  bio: string | null
  imageUrl: string | null
  position: string | null
  heightCm: number | null
  weightKg: number | null
  nationality: string | null
  teams: Set<string>
  leagues: Set<string>
  games: number
  statCount: number
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    const rows = await sql<
      {
        id: string; slug: string; first_name: string; last_name: string
        bio: string | null; image_url: string | null; position: string | null
        height_cm: number | null; weight_kg: number | null; nationality: string | null
        team_id: string | null; league_slug: string; games_played: number | null
      }[]
    >`
      select p.id, p.slug, p.first_name, p.last_name, p.bio, p.image_url, p.position,
        p.height_cm, p.weight_kg, p.nationality,
        pss.team_id, l.slug as league_slug, pss.games_played
      from players p
      join player_season_stats pss on pss.player_id = p.id
      join leagues l on l.id = pss.league_id
    `
    const byId = new Map<string, Rec>()
    for (const r of rows) {
      let rec = byId.get(r.id)
      if (!rec) {
        rec = {
          id: r.id, slug: r.slug, firstName: r.first_name, lastName: r.last_name,
          bio: r.bio, imageUrl: r.image_url, position: r.position, heightCm: r.height_cm,
          weightKg: r.weight_kg, nationality: r.nationality,
          teams: new Set(), leagues: new Set(), games: 0, statCount: 0,
        }
        byId.set(r.id, rec)
      }
      if (r.team_id) rec.teams.add(r.team_id)
      rec.leagues.add(r.league_slug)
      rec.games += r.games_played ?? 0
      rec.statCount++
    }

    // Group by (team, folded surname).
    const groups = new Map<string, Rec[]>()
    for (const rec of byId.values()) {
      const surname = fold(rec.lastName)
      if (surname.length < 3) continue
      for (const teamId of rec.teams) {
        const key = `${teamId}::${surname}`
        const g = groups.get(key) ?? []
        if (!g.includes(rec)) g.push(rec)
        groups.set(key, g)
      }
    }

    // Collect merge pairs that pass all guards (dedup pairs across group keys).
    const pairKey = (a: string, b: string) => [a, b].sort().join("|")
    const pairs = new Map<string, [Rec, Rec]>()
    for (const g of groups.values()) {
      if (g.length < 2) continue
      for (let i = 0; i < g.length; i++) {
        for (let j = i + 1; j < g.length; j++) {
          const a = g[i], b = g[j]
          const disjoint = [...a.leagues].every((l) => !b.leagues.has(l))
          if (!disjoint) continue
          // Never bridge the FEB↔top boundary (amateur namesake vs professional).
          if ((hasFeb(a.leagues) && hasTop(b.leagues)) || (hasFeb(b.leagues) && hasTop(a.leagues))) continue
          if (!firstNameCompatible(a.firstName, b.firstName)) continue
          pairs.set(pairKey(a.id, b.id), [a, b])
        }
      }
    }

    if (pairs.size === 0) {
      console.log("[crossleague] no merge candidates found")
      return
    }
    console.log(`[crossleague] ${pairs.size} merge pair(s):`)
    let merged = 0
    for (const [a, b] of pairs.values()) {
      const [winner, loser] =
        a.games !== b.games
          ? a.games > b.games ? [a, b] : [b, a]
          : a.statCount >= b.statCount ? [a, b] : [b, a]
      console.log(
        `  keep ${winner.firstName} ${winner.lastName} [${winner.slug}] (${[...winner.leagues].join("+")})  <-  ` +
          `${loser.firstName} ${loser.lastName} [${loser.slug}] (${[...loser.leagues].join("+")})`,
      )
      if (DRY) continue
      await sql.begin(async (tx) => {
        // Disjoint leagues => safe to move all rows, but keep the collision guard.
        await tx`
          delete from player_season_stats d
          where d.player_id = ${loser.id} and exists (
            select 1 from player_season_stats k
            where k.player_id = ${winner.id} and k.team_id = d.team_id
              and k.league_id = d.league_id and k.season_id = d.season_id)`
        await tx`update player_season_stats set player_id = ${winner.id} where player_id = ${loser.id}`
        const fills: Record<string, string | number> = {}
        // Prefer the fuller legal first name for display (Facu -> Facundo).
        if (loser.firstName.length > winner.firstName.length) fills.first_name = loser.firstName
        if (winner.bio == null && loser.bio != null) fills.bio = loser.bio
        if (winner.imageUrl == null && loser.imageUrl != null) fills.image_url = loser.imageUrl
        if (winner.position == null && loser.position != null) fills.position = loser.position
        if (winner.heightCm == null && loser.heightCm != null) fills.height_cm = loser.heightCm
        if (winner.weightKg == null && loser.weightKg != null) fills.weight_kg = loser.weightKg
        if (winner.nationality == null && loser.nationality != null) fills.nationality = loser.nationality
        if (Object.keys(fills).length) await tx`update players set ${tx(fills)} where id = ${winner.id}`
        await tx`delete from players where id = ${loser.id}`
      })
      merged++
    }
    console.log(`\n[crossleague] ${DRY ? "(dry) " : ""}merged=${merged}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("CROSSLEAGUE DEDUPE FAILED:", e?.message ?? e)
  process.exit(1)
})
