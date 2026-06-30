/*
 * Repairs the FEB ↔ top-tier name-collision merges.
 *
 * Per the domain invariant (see src/lib/leagues-tier.ts) a single person cannot
 * hold both a FEB stat row (Primera FEB / Segunda FEB / Tercera FEB) and a top-tier one
 * (ACB / EuroLeague / NBA). Where one player record carries both, the top-tier
 * identity OWNS the record (its slug, bio, photo, height and nationality all
 * describe the professional) and the FEB rows belong to an amateur namesake the
 * loose name matcher wrongly fused in.
 *
 * For each such record we:
 *   1. mint a NEW player row for the namesake (same name, EMPTY bio/photo/body
 *      fields — those described the professional and would be wrong here; the
 *      FEB backfill fills them from feb.es afterwards),
 *   2. move every FEB stat row off the professional onto the namesake.
 * No collisions are possible because the namesake row is brand new.
 *
 * Enrichment is automatic: the FEB merge happened BECAUSE the namesake's name
 * normalizes identically to the professional's, so the namesake row normalizes
 * to the very name the FEB scrape returns. Re-running `pnpm sync:feb` (with the
 * hardened, tier-aware matcher) reuses the namesake row and fills its photo,
 * position, height, weight and nationality from feb.es.
 *
 * Destructive. Preview first:
 *   pnpm exec tsx scripts/split-feb-namesakes.ts --dry
 *   pnpm exec tsx scripts/split-feb-namesakes.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"
import { FEB_LEAGUE_SLUGS } from "@/lib/leagues-tier"
import { slugify } from "@/lib/sync/slug"

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

const DRY = process.argv.includes("--dry")

type StatRow = {
  player_id: string
  stat_id: string
  league_id: string
  league_slug: string
  team_name: string | null
  season_name: string
  games: number | null
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    const players = await sql<
      { id: string; slug: string; first_name: string; last_name: string }[]
    >`select id, slug, first_name, last_name from players`
    const playerById = new Map(players.map((p) => [p.id, p]))

    const stats = await sql<StatRow[]>`
      select pss.player_id, pss.id as stat_id, pss.league_id, l.slug as league_slug,
        t.name as team_name, s.name as season_name, pss.games_played as games
      from player_season_stats pss
      join leagues l on l.id = pss.league_id
      left join teams t on t.id = pss.team_id
      join seasons s on s.id = pss.season_id
    `
    const byPlayer = new Map<string, StatRow[]>()
    for (const r of stats) {
      const l = byPlayer.get(r.player_id) ?? []
      l.push(r)
      byPlayer.set(r.player_id, l)
    }

    // Suspects: a record with at least one FEB row and at least one top row.
    const suspects: { id: string; feb: StatRow[]; top: StatRow[] }[] = []
    for (const [pid, rows] of byPlayer) {
      const feb = rows.filter((r) => FEB_LEAGUE_SLUGS.has(r.league_slug))
      const top = rows.filter((r) => !FEB_LEAGUE_SLUGS.has(r.league_slug))
      if (feb.length && top.length) suspects.push({ id: pid, feb, top })
    }
    suspects.sort((a, b) => {
      const pa = playerById.get(a.id)!, pb = playerById.get(b.id)!
      return `${pa.last_name}${pa.first_name}`.localeCompare(`${pb.last_name}${pb.first_name}`)
    })

    if (suspects.length === 0) {
      console.log("[split-feb] no FEB↔top contaminated records found — nothing to do")
      return
    }

    const usedSlugs = new Set(players.map((p) => p.slug))
    const uniqueFebSlug = (firstName: string, lastName: string, febSlugHint: string): string => {
      const root = slugify(`${firstName} ${lastName}`) || "player"
      const base = `${root}-${febSlugHint}`
      if (!usedSlugs.has(base)) { usedSlugs.add(base); return base }
      let i = 2
      while (usedSlugs.has(`${base}-${i}`)) i++
      const s = `${base}-${i}`
      usedSlugs.add(s)
      return s
    }

    console.log(`[split-feb] ${suspects.length} contaminated record(s)\n`)
    let split = 0
    let movedRows = 0
    let multiTeamFeb = 0

    for (const s of suspects) {
      const p = playerById.get(s.id)!
      // The FEB league the namesake mostly belongs to drives the slug suffix.
      const febSlugHint = s.feb[0]!.league_slug
      const newSlug = uniqueFebSlug(p.first_name, p.last_name, febSlugHint)
      const febTeams = new Set(s.feb.map((r) => `${r.team_name}|${r.season_name}`))
      if (new Set(s.feb.map((r) => r.team_name)).size > 1) multiTeamFeb++

      console.log(
        `  "${p.first_name} ${p.last_name}"  pro=[${p.slug}] keeps ` +
          `${[...new Set(s.top.map((r) => r.league_slug))].join("+")}  ` +
          `→ new namesake [${newSlug}] gets ${s.feb.length} FEB row(s) ` +
          `(${[...febTeams].map((t) => t.split("|")[0]).join(", ")})`,
      )

      if (DRY) { split++; movedRows += s.feb.length; continue }

      await sql.begin(async (tx) => {
        const [namesake] = await tx<{ id: string }[]>`
          insert into players (first_name, last_name, slug)
          values (${p.first_name}, ${p.last_name}, ${newSlug})
          returning id
        `
        const febStatIds = s.feb.map((r) => r.stat_id)
        await tx`
          update player_season_stats set player_id = ${namesake!.id}
          where id in ${tx(febStatIds)}
        `
      })
      split++
      movedRows += s.feb.length
    }

    console.log(
      `\n[split-feb] ${DRY ? "(dry) " : ""}records split=${split} | FEB stat rows moved=${movedRows}`,
    )
    if (multiTeamFeb > 0) {
      console.log(
        `[split-feb] note: ${multiTeamFeb} namesake(s) carry FEB rows from MULTIPLE clubs in ` +
          `one season — those are likely several different EBA people too, but absent any ` +
          `distinguishing signal (birthdate is 0% populated) they are kept as one record.`,
      )
    }
    if (!DRY) {
      console.log(
        `[split-feb] next: run "pnpm sync:feb" to backfill the new namesakes' photo/bio from feb.es`,
      )
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("SPLIT-FEB FAILED:", e?.message ?? e)
  process.exit(1)
})
