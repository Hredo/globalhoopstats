/*
 * Merges duplicate player records that are the SAME person split by a name
 * variant the accent-fold pass misses, when both live in the SAME league (so
 * dedupe-players-crossleague.ts skips them for failing its disjoint-leagues
 * guard). Two records are clustered when they share an accent-folded SURNAME and
 * either:
 *   - their accent-folded FULL names are identical (pure accent variant, e.g.
 *     "Juan Núñez" vs "Juan Nunez", "Andrés Feliz" vs "Andres Feliz"), or
 *   - one accent-folded FIRST name is a strict prefix (>=3 chars) of the other
 *     (nickname/legal form, e.g. "Facu" -> "Facundo", "Will" -> "William",
 *     "Matt" -> "Matthew").
 * Strict-prefix avoids merging distinct same-surname people (Tre/Tyus/Spencer
 * Jones never prefix one another).
 *
 * Per the data model ONE person keeps ONE record with SEPARATE per-league stat
 * rows: the winner (most games, then most stat rows, then fullest bio) absorbs
 * the others' stat rows. When two rows collide on (team, league, season) the
 * MORE COMPLETE one is kept. The winner's display name is accent-upgraded (use
 * an accented variant of the same name if a loser has one) and its null bio
 * fields are filled from a loser. Losers are then deleted.
 *
 * Destructive. Always preview first:
 *   pnpm exec tsx scripts/dedupe-players-name-variants.ts --dry
 *   pnpm exec tsx scripts/dedupe-players-name-variants.ts
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

const DRY = process.argv.includes("--dry")

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
const accentCount = (s: string) => {
  let n = 0
  for (const ch of s.normalize("NFD")) if (/[̀-ͯ]/.test(ch)) n++
  return n
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
const completeness = (s: Stat) => COMPLETENESS_COLS.reduce((n, c) => n + (s[c] != null ? 1 : 0), 0)

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

/** Same person? Identical folded full name, or one folded first name is a strict prefix of the other. */
function linked(a: Player, b: Player): boolean {
  if (fold(`${a.first_name} ${a.last_name}`) === fold(`${b.first_name} ${b.last_name}`)) return true
  const fa = fold(a.first_name), fb = fold(b.first_name)
  if (!fa || !fb || fa === fb) return false
  const [short, long] = fa.length <= fb.length ? [fa, fb] : [fb, fa]
  return short.length >= 3 && long.startsWith(short)
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
    // Group by folded surname, then cluster linked records via union-find.
    const bySurname = new Map<string, Player[]>()
    for (const p of players) {
      const k = fold(p.last_name)
      if (k.length < 3) continue
      const g = bySurname.get(k) ?? []
      g.push(p)
      bySurname.set(k, g)
    }

    const clusters: Player[][] = []
    for (const group of bySurname.values()) {
      if (group.length < 2) continue
      const parent = group.map((_, i) => i)
      const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          if (linked(group[i], group[j])) parent[find(i)] = find(j)
      const byRoot = new Map<number, Player[]>()
      for (let i = 0; i < group.length; i++) {
        const r = find(i)
        const l = byRoot.get(r) ?? []
        l.push(group[i])
        byRoot.set(r, l)
      }
      for (const c of byRoot.values()) if (c.length > 1) clusters.push(c)
    }

    // FEB ↔ top-tier guard: never merge a cluster that mixes a FEB namesake
    // with a professional (see src/lib/leagues-tier.ts).
    const tierRows = await sql<{ player_id: string; slug: string }[]>`
      select distinct pss.player_id, l.slug
      from player_season_stats pss join leagues l on l.id = pss.league_id
    `
    const FEB = new Set(["leb-oro", "leb-plata", "eba"])
    const tiersOf = new Map<string, Set<string>>()
    for (const r of tierRows) {
      const set = tiersOf.get(r.player_id) ?? new Set<string>()
      set.add(FEB.has(r.slug) ? "feb" : "top")
      tiersOf.set(r.player_id, set)
    }
    let skippedFeb = 0
    const safeClusters = clusters.filter((c) => {
      const t = new Set<string>()
      for (const p of c) for (const x of tiersOf.get(p.id) ?? []) t.add(x)
      if (t.has("feb") && t.has("top")) {
        console.log(`[name-variants] SKIP "${c[0]!.first_name} ${c[0]!.last_name}" — FEB↔top (different people)`)
        skippedFeb++
        return false
      }
      return true
    })

    console.log(
      `[name-variants] ${clusters.length} duplicate cluster(s); ${skippedFeb} skipped (FEB↔top); ${safeClusters.length} to process`,
    )
    let merged = 0, movedStats = 0, droppedStats = 0, deletedPlayers = 0

    for (const cluster of safeClusters) {
      const ids = cluster.map((p) => p.id)
      const stats = await sql<Stat[]>`
        select id, player_id, team_id, league_id, season_id, games_played,
          minutes_total, points_total, rebounds_total, assists_total, steals_total,
          blocks_total, fg_made, fg_attempted, three_made, three_attempted,
          ft_made, ft_attempted, offensive_rebounds, defensive_rebounds,
          fouls_total, true_shooting_pct
        from player_season_stats where player_id in ${sql(ids)}
      `
      const byPlayer = new Map<string, Stat[]>()
      for (const s of stats) {
        const l = byPlayer.get(s.player_id) ?? []
        l.push(s)
        byPlayer.set(s.player_id, l)
      }
      const score = (p: Player) => {
        const ps = byPlayer.get(p.id) ?? []
        const games = ps.reduce((n, s) => n + (s.games_played ?? 0), 0)
        return games * 100 + ps.length * 20 +
          (p.bio ? 8 : 0) + (p.image_url ? 6 : 0) +
          (p.nationality ? 4 : 0) + (p.position ? 3 : 0) + (p.height_cm ? 1 : 0)
      }
      const ordered = [...cluster].sort((a, b) => score(b) - score(a))
      const winner = ordered[0]
      const losers = ordered.slice(1)

      // Surviving stat row per (team, league, season).
      const best = new Map<string, Stat>()
      for (const s of stats) {
        const k = `${s.team_id}|${s.league_id}|${s.season_id}`
        const prior = best.get(k)
        best.set(k, prior ? better(prior, s) : s)
      }
      const keepIds = new Set([...best.values()].map((s) => s.id))
      const toDrop = stats.filter((s) => !keepIds.has(s.id))
      const toMove = [...best.values()].filter((s) => s.player_id !== winner.id)

      // Accent-upgrade the display name (same name, fuller diacritics).
      const nameFills: Record<string, string> = {}
      const upgrade = (col: "first_name" | "last_name") => {
        let bestName = winner[col]
        for (const c of cluster) {
          if (fold(c[col]) === fold(bestName) && accentCount(c[col]) > accentCount(bestName)) bestName = c[col]
        }
        if (bestName !== winner[col]) nameFills[col] = bestName
      }
      upgrade("first_name")
      upgrade("last_name")

      // Fill winner's null bio fields from any loser.
      const fills: Record<string, string | number> = { ...nameFills }
      ;(["bio", "image_url", "position", "height_cm", "weight_kg", "nationality"] as (keyof Player)[]).forEach((col) => {
        if (winner[col] == null) {
          const v = losers.find((l) => l[col] != null)?.[col]
          if (v != null) fills[col] = v as string | number
        }
      })

      const winName = `${nameFills.first_name ?? winner.first_name} ${nameFills.last_name ?? winner.last_name}`
      console.log(
        `\n[${fold(winner.last_name)}] keep "${winName}" (${winner.slug})  <-  ` +
          losers.map((l) => `"${l.first_name} ${l.last_name}" (${l.slug})`).join(", "),
      )
      console.log(`  stat rows: ${stats.length} -> keep ${best.size} (move ${toMove.length}, drop ${toDrop.length})`)
      if (Object.keys(fills).length) console.log(`  fill winner: ${Object.keys(fills).join(", ")}`)

      if (DRY) continue

      await sql.begin(async (tx) => {
        if (toDrop.length) await tx`delete from player_season_stats where id in ${tx(toDrop.map((s) => s.id))}`
        for (const s of toMove) await tx`update player_season_stats set player_id = ${winner.id} where id = ${s.id}`
        if (Object.keys(fills).length) await tx`update players set ${tx(fills)} where id = ${winner.id}`
        if (losers.length) await tx`delete from players where id in ${tx(losers.map((l) => l.id))}`
      })
      movedStats += toMove.length
      droppedStats += toDrop.length
      deletedPlayers += losers.length
      merged++
    }

    console.log(
      `\n[name-variants] ${DRY ? "(dry) " : ""}clusters merged=${merged} | stat rows moved=${movedStats} dropped=${droppedStats} | players deleted=${deletedPlayers}`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("DEDUPE NAME-VARIANTS FAILED:", e?.message ?? e)
  process.exit(1)
})
