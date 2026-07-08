/*
 * Builds REAL per-zone shooting splits for NBA players from stats.nba.com's
 * shotchartdetail feed and stores them on player_season_stats.shot_zones (jsonb),
 * exactly like backfill-euroleague-shot-zones.ts but for the NBA.
 *
 * stats.nba.com already classifies every shot (SHOT_ZONE_BASIC / SHOT_ZONE_AREA),
 * so we map those official zones straight onto our eleven half-court buckets — no
 * coordinate maths needed. We pull per team (PlayerID=0 & TeamID=<id>) to keep
 * each response small, aggregate per player across the season, name-match to our
 * DB players, and write the result.
 *
 * NOTE: stats.nba.com blocks many datacenter IPs — run this from the same machine
 * your `pnpm sync:nba` runs on. Usage:
 *   pnpm exec tsx scripts/backfill-nba-shot-zones.ts [--dry] [--season=2025-26] [--force]
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
      /* file may not exist */
    }
  }
}

const DRY = process.argv.includes("--dry")
const SEASON =
  process.argv.find((a) => a.startsWith("--season="))?.slice("--season=".length) ??
  "2025-26"

const NBA_HEADERS = {
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
}

/* ---------------- name matching ------------------------------------------- */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* ---------------- zone model ---------------------------------------------- */
type ZoneKey =
  | "paint"
  | "leftCorner2" | "rightCorner2" | "leftWing2" | "rightWing2" | "frontal2"
  | "leftCorner3" | "rightCorner3" | "leftWing3" | "rightWing3" | "frontal3"

/** Map stats.nba.com's own zone labels onto our eleven buckets. */
function nbaZone(basic: string, area: string): ZoneKey | null {
  const b = basic.trim()
  const a = area.trim()
  const side = a.startsWith("Left") ? "left" : a.startsWith("Right") ? "right" : "center"
  if (b === "Restricted Area" || b === "In The Paint (Non-RA)") return "paint"
  if (b === "Left Corner 3") return "leftCorner3"
  if (b === "Right Corner 3") return "rightCorner3"
  if (b === "Above the Break 3")
    return side === "center" ? "frontal3" : side === "left" ? "leftWing3" : "rightWing3"
  if (b === "Mid-Range") {
    if (side === "center") return "frontal2"
    if (a === "Left Side(L)") return "leftCorner2"
    if (a === "Right Side(R)") return "rightCorner2"
    return side === "left" ? "leftWing2" : "rightWing2"
  }
  return null // Backcourt heaves etc.
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

/* ---------------- stats.nba.com feed -------------------------------------- */
type NbaEnvelope = {
  resultSets: { name: string; headers: string[]; rowSet: (string | number | null)[][] }[]
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url: string, retries = 4): Promise<NbaEnvelope> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: NBA_HEADERS,
        signal: AbortSignal.timeout(45_000),
      })
      if (res.ok) return (await res.json()) as NbaEnvelope
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const wait = 2000 * 2 ** attempt
        console.warn(`  [http ${res.status}] backing off ${wait}ms`)
        await sleep(wait)
        continue
      }
      throw new Error(`${res.status} ${res.statusText}`)
    } catch (e) {
      if (attempt < retries) {
        const wait = 2000 * 2 ** attempt
        console.warn(`  [fetch] ${(e as Error).message} — retry in ${wait}ms`)
        await sleep(wait)
        continue
      }
      throw e
    }
  }
}

function rows(env: NbaEnvelope, name: string): Record<string, string | number | null>[] {
  const set = env.resultSets.find((rs) => rs.name === name)
  if (!set) return []
  return set.rowSet.map((row) => {
    const o: Record<string, string | number | null> = {}
    for (let i = 0; i < set.headers.length; i++) o[set.headers[i]!] = row[i] ?? null
    return o
  })
}

async function fetchTeamIds(): Promise<string[]> {
  const url = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${SEASON}&SeasonType=Regular+Season`
  const env = await fetchJson(url)
  return rows(env, "Standings")
    .map((r) => (r.TeamID != null ? String(r.TeamID) : null))
    .filter((x): x is string => !!x)
}

async function fetchTeamShots(teamId: string) {
  const p = new URLSearchParams({
    ContextMeasure: "FGA", LeagueID: "00", Season: SEASON, SeasonType: "Regular Season",
    PlayerID: "0", TeamID: teamId, Period: "0", Month: "0", OpponentTeamID: "0",
    LastNGames: "0", PlayerPosition: "", GameSegment: "", Location: "", Outcome: "",
    SeasonSegment: "", VsConference: "", VsDivision: "", RookieYear: "", DateFrom: "",
    DateTo: "", GameID: "",
  })
  const env = await fetchJson(`https://stats.nba.com/stats/shotchartdetail?${p}`)
  return rows(env, "Shot_Chart_Detail")
}

async function main() {
  loadEnv()

  /* ---- 1. aggregate shots per team ---- */
  const teamIds = await fetchTeamIds()
  console.log(`[teams] ${teamIds.length} NBA teams for ${SEASON}`)

  const byPlayer = new Map<string, { name: string; tally: Tally }>()
  let totalShots = 0
  let failed = 0
  for (const [i, teamId] of teamIds.entries()) {
    let shots: Record<string, string | number | null>[] = []
    try {
      shots = await fetchTeamShots(teamId)
    } catch (e) {
      console.warn(`  [team ${teamId}] failed: ${(e as Error).message}`)
      failed++
      await sleep(1500)
      continue
    }
    for (const s of shots) {
      const zone = nbaZone(String(s.SHOT_ZONE_BASIC ?? ""), String(s.SHOT_ZONE_AREA ?? ""))
      if (!zone) continue
      const id = s.PLAYER_ID != null ? String(s.PLAYER_ID) : null
      if (!id) continue
      const made = Number(s.SHOT_MADE_FLAG) === 1
      let entry = byPlayer.get(id)
      if (!entry) {
        entry = { name: String(s.PLAYER_NAME ?? id).trim(), tally: emptyTally() }
        byPlayer.set(id, entry)
      }
      entry.tally[zone].a += 1
      if (made) entry.tally[zone].m += 1
      totalShots++
    }
    console.log(`  [teams] ${i + 1}/${teamIds.length} (${totalShots} shots)`)
    await sleep(1200) // polite throttle
  }
  console.log(`[shots] ${totalShots} FGA, ${byPlayer.size} players (${failed} teams failed)`)

  const missShare = teamIds.length > 0 ? failed / teamIds.length : 1
  if (missShare > 0.05 && !process.argv.includes("--force")) {
    console.error(
      `ABORT: ${failed}/${teamIds.length} teams missing. Refusing to overwrite with a partial ` +
        `season (pass --force to override).`,
    )
    process.exit(1)
  }

  /* ---- 2. name lookup (exact normalized, then unique-surname fallback) ---- */
  const byName = new Map<string, { name: string; tally: Tally }>()
  const totalA = (e: { tally: Tally }) => Object.values(e.tally).reduce((s, z) => s + z.a, 0)
  for (const entry of byPlayer.values()) {
    const key = norm(entry.name)
    const prior = byName.get(key)
    if (!prior || totalA(entry) > totalA(prior)) byName.set(key, entry)
  }
  const bySurname = new Map<string, { name: string; tally: Tally } | null>()
  for (const [key, entry] of byName) {
    const surname = key.split(" ").pop() ?? ""
    if (!surname) continue
    const prior = bySurname.get(surname)
    if (prior === undefined) bySurname.set(surname, entry)
    else if (prior !== null && prior.name !== entry.name) bySurname.set(surname, null)
  }
  const lookup = (dbName: string) => {
    const key = norm(dbName)
    const exact = byName.get(key)
    if (exact) return exact
    const surname = key.split(" ").pop() ?? ""
    return bySurname.get(surname) ?? undefined
  }

  /* ---- 3. write onto current NBA season rows ---- */
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, connect_timeout: 20 })
  try {
    await sql`alter table player_season_stats add column if not exists shot_zones jsonb`
    const dbRows = await sql<{ stat_id: string; name: string }[]>`
      select pss.id as stat_id, p.first_name || ' ' || p.last_name as name
      from player_season_stats pss
      join players p on p.id = pss.player_id
      join leagues l on l.id = pss.league_id
      join seasons s on s.id = pss.season_id
      where l.slug = 'nba' and s.is_current
    `
    console.log(`[db] ${dbRows.length} NBA season rows`)
    let updated = 0
    let unmatched = 0
    for (const r of dbRows) {
      const entry = lookup(r.name)
      if (!entry) {
        unmatched++
        continue
      }
      const zones: Record<string, { m: number; a: number }> = {}
      for (const [zone, z] of Object.entries(entry.tally)) if (z.a > 0) zones[zone] = z
      if (Object.keys(zones).length === 0) continue
      if (DRY) {
        console.log(`  [dry] ${r.name} → ${Object.keys(zones).length} zones`)
        continue
      }
      await sql`update player_season_stats set shot_zones = ${sql.json(zones)} where id = ${r.stat_id}`
      updated++
    }
    console.log(`[db] updated=${updated} unmatched=${unmatched}${DRY ? " (dry run)" : ""}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error("NBA SHOT-ZONE BACKFILL FAILED:", e?.message ?? e)
  process.exit(1)
})
