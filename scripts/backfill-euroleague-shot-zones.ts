/*
 * Builds REAL per-zone shooting splits for EuroLeague players from the official
 * shot-by-shot feed and stores them on player_season_stats.shot_zones (jsonb).
 *
 * Source: live.euroleague.net/api/Points?gamecode=N&seasoncode=EYYYY returns
 * every field-goal attempt with COORD_X / COORD_Y (centimetres from the basket)
 * and an ID_ACTION of 2FGM / 2FGA / 3FGM / 3FGA. We bucket each shot into one of
 * eleven half-court zones, aggregate made/attempted per player across the whole
 * season, match the EuroLeague person to our DB player by name, and write the
 * result. ACB / FEB publish no shot coordinates, so those leagues keep a null
 * column and the UI shows an honest "no zone data" state.
 *
 * Usage: pnpm exec tsx scripts/backfill-euroleague-shot-zones.ts [--dry] [--season=E2025] [--force]
 *   --dry    aggregate + match but don't write.
 *   --force  write even if >5% of games failed (feed rate-limits; a partial run
 *            would otherwise refuse, to avoid clobbering complete data).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    process.env[m[1]] = v
  }
}

const DRY = process.argv.includes("--dry")
// Season code for the official EuroLeague shot feed. Must match the roster the
// DB actually holds: with the basketball-reference year bug fixed, EuroLeague is
// the genuine 2025-26 season (feed code E2025).
const SEASON =
  process.argv.find((a) => a.startsWith("--season="))?.slice("--season=".length) ??
  "E2025"
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

/* ---------------- name matching (mirrors backfill-euroleague-stats.ts) ------ */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
/** EuroLeague feed names come as "LASTNAME, FIRSTNAME". */
function aliasToNormName(alias: string): string {
  const [last, first] = alias.split(",").map((p) => p.trim())
  return norm(first ? `${first} ${last}` : alias)
}

/* ---------------- zone model ----------------------------------------------- */
type ZoneKey =
  | "paint"
  | "leftCorner2" | "rightCorner2" | "leftWing2" | "rightWing2" | "frontal2"
  | "leftCorner3" | "rightCorner3" | "leftWing3" | "rightWing3" | "frontal3"

/**
 * Bucket a shot by its court coordinates. Origin is the basket; x is lateral
 * (negative = left from the shooter's view), y is distance up-court, both in cm.
 * The 2-vs-3 flag is authoritative (from ID_ACTION), so we only use geometry for
 * paint radius and the corner / wing / top angle.
 */
function classifyZone(x: number, y: number, is3: boolean): ZoneKey {
  const r = Math.hypot(x, y)
  if (!is3 && r <= 300) return "paint" // ~3m: paint + short range around the rim
  const side = x < 0 ? "left" : "right"
  const deg = (Math.atan2(y, Math.abs(x)) * 180) / Math.PI // 0 = baseline, 90 = top
  const suffix = is3 ? "3" : "2"
  if (deg >= 63) return (is3 ? "frontal3" : "frontal2") as ZoneKey
  const band = deg < 25 ? "Corner" : "Wing"
  return `${side}${band}${suffix}` as ZoneKey
}

type Tally = Record<ZoneKey, { m: number; a: number }>
function emptyTally(): Tally {
  return {
    paint: { m: 0, a: 0 },
    leftCorner2: { m: 0, a: 0 }, rightCorner2: { m: 0, a: 0 },
    leftWing2: { m: 0, a: 0 }, rightWing2: { m: 0, a: 0 }, frontal2: { m: 0, a: 0 },
    leftCorner3: { m: 0, a: 0 }, rightCorner3: { m: 0, a: 0 },
    leftWing3: { m: 0, a: 0 }, rightWing3: { m: 0, a: 0 }, frontal3: { m: 0, a: 0 },
  }
}

/* ---------------- EuroLeague feeds ----------------------------------------- */
type PointRow = {
  ID_PLAYER: string
  PLAYER: string
  ID_ACTION: string
  COORD_X: number
  COORD_Y: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchJson<T>(url: string, retries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    })
    if (res.ok) return (await res.json()) as T
    // The feed rate-limits aggressively; back off and retry on 429 / 5xx.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = 2000 * 2 ** attempt + Math.floor(Math.random() * 500)
      console.warn(`  [http ${res.status}] backing off ${wait}ms → ${url}`)
      await sleep(wait)
      continue
    }
    throw new Error(`${res.status} ${res.statusText} ${url}`)
  }
}

/** All played game codes for the season, from the v2 games list. */
async function fetchPlayedGameCodes(): Promise<number[]> {
  const data = await fetchJson<{ data: Array<{ gameCode: number; played: boolean }> }>(
    `https://api-live.euroleague.net/v2/competitions/E/seasons/${SEASON}/games`,
  )
  return data.data
    .filter((g) => g.played && Number.isFinite(g.gameCode))
    .map((g) => g.gameCode)
    .sort((a, b) => a - b)
}

async function fetchGamePoints(gameCode: number): Promise<PointRow[]> {
  const data = await fetchJson<{ Rows?: PointRow[] }>(
    `https://live.euroleague.net/api/Points?gamecode=${gameCode}&seasoncode=${SEASON}`,
  )
  return data.Rows ?? []
}

const SHOT_ACTIONS = new Set(["2FGM", "2FGA", "3FGM", "3FGA"])

async function main() {
  loadEnv()

  /* ---- 1. aggregate shots across every played game ---- */
  const gameCodes = await fetchPlayedGameCodes()
  console.log(`[games] ${gameCodes.length} played games for ${SEASON}`)

  // key = EL person code (trimmed); value = { name, tally }
  const byPlayer = new Map<string, { name: string; tally: Tally }>()
  let totalShots = 0
  let done = 0
  let failed = 0
  for (const code of gameCodes) {
    let rows: PointRow[] = []
    try {
      rows = await fetchGamePoints(code)
    } catch (e) {
      console.warn(`  [game ${code}] fetch failed: ${(e as Error).message}`)
      failed++
      await sleep(1500)
      continue
    }
    for (const row of rows) {
      const action = row.ID_ACTION?.trim()
      if (!action || !SHOT_ACTIONS.has(action)) continue
      const id = row.ID_PLAYER?.trim()
      if (!id) continue
      const is3 = action.startsWith("3")
      const made = action.endsWith("M")
      const zone = classifyZone(Number(row.COORD_X), Number(row.COORD_Y), is3)
      let entry = byPlayer.get(id)
      if (!entry) {
        entry = { name: row.PLAYER?.trim() ?? id, tally: emptyTally() }
        byPlayer.set(id, entry)
      }
      entry.tally[zone].a += 1
      if (made) entry.tally[zone].m += 1
      totalShots++
    }
    done++
    if (done % 25 === 0) console.log(`  [games] ${done}/${gameCodes.length} (${totalShots} shots)`)
    await sleep(1800) // polite throttle — the feed 429s aggressively when rushed
  }
  console.log(
    `[shots] ${totalShots} field-goal attempts, ${byPlayer.size} players (${failed} games failed)`,
  )

  // Guard: a rate-limited run holds only partial season tallies. Writing them
  // would OVERWRITE complete data with worse numbers, so bail out unless the
  // fetch was nearly whole (or --force is passed to accept a partial season).
  const missShare = gameCodes.length > 0 ? failed / gameCodes.length : 1
  if (missShare > 0.05 && !process.argv.includes("--force")) {
    console.error(
      `ABORT: ${failed}/${gameCodes.length} games missing (${(missShare * 100).toFixed(1)}%). ` +
        `Refusing to overwrite existing zones with a partial season. ` +
        `Wait for the feed's rate limit to reset and re-run, or pass --force.`,
    )
    process.exit(1)
  }

  /* ---- 2. name lookup (exact normalized, then unique-surname fallback) ---- */
  const byName = new Map<string, { name: string; tally: Tally }>()
  for (const entry of byPlayer.values()) {
    const key = aliasToNormName(entry.name)
    const prior = byName.get(key)
    // Keep the entry with more total attempts if two feed names collide.
    const total = (e: { tally: Tally }) =>
      Object.values(e.tally).reduce((s, z) => s + z.a, 0)
    if (!prior || total(entry) > total(prior)) byName.set(key, entry)
  }
  const bySurname = new Map<string, { name: string; tally: Tally } | null>()
  for (const [key, entry] of byName) {
    const surname = key.split(" ").pop() ?? ""
    if (!surname) continue
    const prior = bySurname.get(surname)
    if (prior === undefined) bySurname.set(surname, entry)
    else if (prior !== null && prior.name !== entry.name) bySurname.set(surname, null)
  }
  // Token sets for a subset fallback: catches double-surname spellings that
  // differ between the DB and the feed (e.g. "Hugo González" vs the feed's
  // "González García, Hugo"). We only accept a subset match when exactly one
  // feed player shares the first name and every token of the shorter name.
  const feedTokens = [...byName].map(([key, entry]) => ({ key, entry, toks: new Set(key.split(" ")) }))
  const lookup = (dbName: string) => {
    const key = norm(dbName)
    const exact = byName.get(key)
    if (exact) return exact
    const surname = key.split(" ").pop() ?? ""
    const bySur = bySurname.get(surname)
    if (bySur) return bySur
    const dbToks = key.split(" ")
    const dbFirst = dbToks[0]
    const dbSet = new Set(dbToks)
    const subset = feedTokens.filter((f) => {
      if (!f.toks.has(dbFirst)) return false // first name must be shared
      const [small, big] = dbSet.size <= f.toks.size ? [dbSet, f.toks] : [f.toks, dbSet]
      for (const tk of small) if (!big.has(tk)) return false
      return true
    })
    return subset.length === 1 ? subset[0].entry : undefined
  }

  /* ---- 3. write onto the current EuroLeague season rows ---- */
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connect_timeout: 20,
  })
  try {
    await sql`alter table player_season_stats add column if not exists shot_zones jsonb`

    const rows = await sql<{ stat_id: string; name: string }[]>`
      select pss.id as stat_id, p.first_name || ' ' || p.last_name as name
      from player_season_stats pss
      join players p on p.id = pss.player_id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'euroleague' and s.is_current
    `
    console.log(`[db] ${rows.length} EuroLeague season rows`)

    // Wipe existing zones first so a season change (or players who no longer
    // match) can't leave stale data behind — this is a full-season rewrite.
    if (!DRY) {
      await sql`
        update player_season_stats set shot_zones = null
        where league_id in (select id from leagues where slug='euroleague')
          and season_id in (select id from seasons where is_current)`
    }

    let updated = 0
    let unmatched = 0
    const unmatchedNames: string[] = []
    for (const r of rows) {
      const entry = lookup(r.name)
      if (!entry) {
        unmatched++
        unmatchedNames.push(r.name)
        continue
      }
      // Trim to zones with at least one attempt to keep the payload lean.
      const zones: Record<string, { m: number; a: number }> = {}
      for (const [zone, z] of Object.entries(entry.tally)) {
        if (z.a > 0) zones[zone] = z
      }
      if (Object.keys(zones).length === 0) continue
      if (DRY) {
        const totalA = Object.values(zones).reduce((s, z) => s + z.a, 0)
        console.log(`  [dry] ${r.name} → ${Object.keys(zones).length} zones, ${totalA} FGA`)
        continue
      }
      await sql`update player_season_stats set shot_zones = ${sql.json(zones)} where id = ${r.stat_id}`
      updated++
    }
    console.log(`[db] updated=${updated} unmatched=${unmatched}${DRY ? " (dry run)" : ""}`)
    if (unmatchedNames.length > 0) {
      console.log(`[db] unmatched sample: ${unmatchedNames.slice(0, 30).join(" | ")}`)
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("SHOT-ZONE BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
