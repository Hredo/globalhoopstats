/*
 * Merges duplicate player records that the cross-league sync minted for one
 * person (e.g. "acb-andres-feliz" + "euroleague-andres-feliz"). Players are
 * grouped by accent-folded full name. Per the data model, ONE person keeps ONE
 * record with SEPARATE per-league stat rows — so stat rows are merged onto the
 * surviving record, and when two rows collide on (team, league, season) the
 * MORE COMPLETE row is kept and the other dropped. Then loser records are
 * deleted and any missing bio fields filled from a loser.
 *
 * Destructive. Always preview first:
 *   pnpm exec tsx scripts/dedupe-players-folded.ts --dry
 *   pnpm exec tsx scripts/dedupe-players-folded.ts
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

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

type Player = {
  id: string
  slug: string
  first_name: string
  last_name: string
  bio: string | null
  image_url: string | null
  position: string | null
  height_cm: number | null
  weight_kg: number | null
  nationality: string | null
}

type Stat = {
  id: string
  player_id: string
  team_id: string
  league_id: string
  season_id: string
  games_played: number | null
  // columns considered for "completeness"
  minutes_total: number | null
  points_total: number | null
  rebounds_total: number | null
  assists_total: number | null
  steals_total: number | null
  blocks_total: number | null
  fg_made: number | null
  fg_attempted: number | null
  three_made: number | null
  three_attempted: number | null
  ft_made: number | null
  ft_attempted: number | null
  offensive_rebounds: number | null
  defensive_rebounds: number | null
  fouls_total: number | null
  true_shooting_pct: number | null
}

const COMPLETENESS_COLS: (keyof Stat)[] = [
  "minutes_total", "points_total", "rebounds_total", "assists_total",
  "steals_total", "blocks_total", "fg_made", "fg_attempted", "three_made",
  "three_attempted", "ft_made", "ft_attempted", "offensive_rebounds",
  "defensive_rebounds", "fouls_total", "true_shooting_pct",
]

function completeness(s: Stat): number {
  return COMPLETENESS_COLS.reduce((n, c) => n + (s[c] != null ? 1 : 0), 0)
}

/** Higher = the row we keep when two collide on (team, league, season). */
function better(a: Stat, b: Stat): Stat {
  const ca = completeness(a), cb = completeness(b)
  if (ca !== cb) return ca > cb ? a : b
  const ga = a.games_played ?? 0, gb = b.games_played ?? 0
  if (ga !== gb) return ga > gb ? a : b
  const pa = a.points_total ?? 0, pb = b.points_total ?? 0
  if (pa !== pb) return pa > pb ? a : b
  const fa = a.fg_attempted ?? 0, fb = b.fg_attempted ?? 0
  return fa >= fb ? a : b
}

async function main() {
  loadEnv()
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    const players = await sql<Player[]>`
      select id, slug, first_name, last_name, bio, image_url, position,
        height_cm, weight_kg, nationality
      from players
    `
    const groups = new Map<string, Player[]>()
    for (const p of players) {
      const key = fold(`${p.first_name} ${p.last_name}`)
      const list = groups.get(key) ?? []
      list.push(p)
      groups.set(key, list)
    }
    const dupGroups = [...groups.entries()].filter(([, g]) => g.length > 1)
    console.log(`[dedupe] ${dupGroups.length} duplicate name group(s)`)

    let merged = 0
    let droppedStats = 0
    let movedStats = 0
    let deletedPlayers = 0

    for (const [key, group] of dupGroups) {
      const ids = group.map((p) => p.id)
      const stats = await sql<Stat[]>`
        select id, player_id, team_id, league_id, season_id, games_played,
          minutes_total, points_total, rebounds_total, assists_total, steals_total,
          blocks_total, fg_made, fg_attempted, three_made, three_attempted,
          ft_made, ft_attempted, offensive_rebounds, defensive_rebounds,
          fouls_total, true_shooting_pct
        from player_season_stats where player_id in ${sql(ids)}
      `
      // Winner: most total games, then most stat rows, then most complete bio.
      const byPlayer = new Map<string, Stat[]>()
      for (const s of stats) {
        const l = byPlayer.get(s.player_id) ?? []
        l.push(s)
        byPlayer.set(s.player_id, l)
      }
      const score = (p: Player) => {
        const ps = byPlayer.get(p.id) ?? []
        const games = ps.reduce((n, s) => n + (s.games_played ?? 0), 0)
        return (
          games * 100 + ps.length * 20 +
          (p.bio ? 8 : 0) + (p.image_url ? 6 : 0) +
          (p.nationality ? 4 : 0) + (p.position ? 3 : 0) + (p.height_cm ? 1 : 0)
        )
      }
      const ordered = [...group].sort((a, b) => score(b) - score(a))
      const winner = ordered[0]
      const losers = ordered.slice(1)

      // Pick the surviving stat row per (team, league, season).
      const best = new Map<string, Stat>()
      for (const s of stats) {
        const k = `${s.team_id}|${s.league_id}|${s.season_id}`
        const prior = best.get(k)
        best.set(k, prior ? better(prior, s) : s)
      }
      const keepIds = new Set([...best.values()].map((s) => s.id))
      const toDrop = stats.filter((s) => !keepIds.has(s.id))
      const toMove = [...best.values()].filter((s) => s.player_id !== winner.id)

      // Fill winner's null bio fields from losers.
      const fills: Record<string, string | number> = {}
      const pick = (col: keyof Player) => {
        if (winner[col] == null) {
          const v = losers.find((l) => l[col] != null)?.[col]
          if (v != null) fills[col] = v as string | number
        }
      }
      ;(["bio", "image_url", "position", "height_cm", "weight_kg", "nationality"] as (keyof Player)[]).forEach(pick)

      console.log(
        `\n[${key}] keep=${winner.slug}  drop=${losers.map((l) => l.slug).join(", ")}`,
      )
      console.log(
        `  stat rows: ${stats.length} -> keep ${best.size} (move ${toMove.length} to winner, drop ${toDrop.length} dup)`,
      )
      if (Object.keys(fills).length) console.log(`  fill winner: ${Object.keys(fills).join(",")}`)

      if (DRY) continue

      await sql.begin(async (tx) => {
        // Drop the non-surviving (duplicate) stat rows first, so reassigning the
        // survivors onto the winner can't hit the unique index.
        if (toDrop.length) {
          await tx`delete from player_season_stats where id in ${tx(toDrop.map((s) => s.id))}`
        }
        for (const s of toMove) {
          await tx`update player_season_stats set player_id = ${winner.id} where id = ${s.id}`
        }
        if (Object.keys(fills).length) {
          await tx`update players set ${tx(fills)} where id = ${winner.id}`
        }
        if (losers.length) {
          await tx`delete from players where id in ${tx(losers.map((l) => l.id))}`
        }
      })
      droppedStats += toDrop.length
      movedStats += toMove.length
      deletedPlayers += losers.length
      merged++
    }

    console.log(
      `\n[dedupe] ${DRY ? "(dry) " : ""}groups merged=${merged} | stat rows moved=${movedStats} dropped=${droppedStats} | players deleted=${deletedPlayers}`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("DEDUPE PLAYERS FAILED:", e?.message ?? e)
  process.exit(1)
})
