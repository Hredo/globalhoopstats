import {
  type SourceAdapter,
  type SourceCoach,
  type SourcePlayer,
  type SourceTeam,
  type SourceTeamStats,
  type ExtractedPlayerStat,
  SOURCE_META,
} from "@/lib/sources/types"
import { fetchText } from "@/lib/sources/fetcher"
import { parseBirthdate, parseHeightToCm } from "@/lib/sync/slug"

const ACB_BASE = "https://www.acb.com"
const ACB_LIGA = "/es/liga"

const SEASON = SOURCE_META.acb.seasonCode
const SEASON_YEAR = SOURCE_META.acb.season

type Raw = Record<string, unknown>

function pickString(row: Raw, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number") return String(v)
  }
  return undefined
}

function pickNumber(row: Raw, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return undefined
}

async function fetchHtml(url: string): Promise<string> {
  // Routed through the shared polite fetcher (identifiable UA, per-host rate
  // limiting, Retry-After handling). Only the language hint is ACB-specific.
  return fetchText(url, {
    headers: { "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
  })
}

function unescapeJsonString(s: string): string {
  let out = ""
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch !== "\\") {
      out += ch
      continue
    }
    const next = s[i + 1]
    if (next === undefined) {
      out += ch
      continue
    }
    if (next === "u") {
      const hex = s.slice(i + 2, i + 6)
      if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16))
        i += 5
        continue
      }
    }
    if (next === '"') out += '"'
    else if (next === "\\") out += "\\"
    else if (next === "/") out += "/"
    else if (next === "b") out += "\b"
    else if (next === "f") out += "\f"
    else if (next === "n") out += "\n"
    else if (next === "r") out += "\r"
    else if (next === "t") out += "\t"
    else out += next
    i++
  }
  return out
}

function getRscPayload(html: string): string {
  const re = /self\.__next_f\.push\(\[\s*1\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]\)/g
  const chunks: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null)
    chunks.push(unescapeJsonString(m[1] ?? ""))
  return chunks.join("")
}

function findBalancedObject(
  rsc: string,
  start: number,
): { start: number; end: number } | null {
  let i = start
  while (i < rsc.length && /\s/.test(rsc[i] ?? "")) i++
  if (rsc[i] !== "{") return null
  let depth = 0,
    inStr = false,
    escape = false
  for (let k = i; k < rsc.length; k++) {
    const c = rsc[k]
    if (inStr) {
      if (escape) escape = false
      else if (c === "\\") escape = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return { start: i, end: k }
    }
  }
  return null
}

function findBalancedArray(
  rsc: string,
  start: number,
): { start: number; end: number } | null {
  let i = start
  while (i < rsc.length && /\s/.test(rsc[i] ?? "")) i++
  if (rsc[i] !== "[") return null
  let depth = 0,
    inStr = false,
    escape = false
  for (let k = i; k < rsc.length; k++) {
    const c = rsc[k]
    if (inStr) {
      if (escape) escape = false
      else if (c === "\\") escape = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "[") depth++
    else if (c === "]") {
      depth--
      if (depth === 0) return { start: i, end: k }
    }
  }
  return null
}

function extractRscObject(rsc: string, key: string): Raw | null {
  const marker = `"${key}":`
  const idx = rsc.indexOf(marker)
  if (idx < 0) return null
  const span = findBalancedObject(rsc, idx + marker.length)
  if (!span) return null
  const text = rsc.slice(span.start, span.end + 1)
  try {
    return JSON.parse(text) as Raw
  } catch {
    return null
  }
}

function extractRscArray(
  rsc: string,
  key: string,
  accept: (items: Raw[]) => boolean = () => true,
): Raw[] {
  // The key is not unique in the payload: since 2026-10 acb.com ships an i18n
  // dictionary (`"teams":"Equipos"`) ahead of the data, so take the first
  // occurrence that actually holds an array (and, when `accept` is given, the
  // one holding the rows the caller is after).
  const marker = `"${key}":`
  for (
    let idx = rsc.indexOf(marker);
    idx >= 0;
    idx = rsc.indexOf(marker, idx + marker.length)
  ) {
    const span = findBalancedArray(rsc, idx + marker.length)
    if (!span) continue
    let items: Raw[]
    try {
      items = JSON.parse(rsc.slice(span.start, span.end + 1)) as Raw[]
    } catch {
      return []
    }
    if (accept(items)) return items
  }
  return []
}

function unwrapTeam(t: Raw): Raw {
  if (t && typeof t === "object" && (t.latest || t.selected))
    return ((t.latest ?? t.selected) as Raw) ?? t
  return t
}

type AcbTeam = {
  sourceId: string
  name: string
  shortName: string
  abbreviation: string
  clubId: number
  logoUrl?: string
  primaryColor?: string
}

type AcbClubInfo = {
  team?: {
    id: number
    clubId: number
    fullName: string
    shortName: string
    abbreviatedName: string
    logo: string
    primaryColorHex: string
  }
  stadiumName?: string
  stadiumAddress?: string
  stadiumCapacity?: number
  foundationYear?: number
  webUrl?: string
  city?: string
}

function fetchTeamsList(): Promise<AcbTeam[]> {
  return memoised("teams", readTeamsList)
}

async function readTeamsList(): Promise<AcbTeam[]> {
  const html = await fetchHtml(`${ACB_BASE}${ACB_LIGA}/equipos`)
  const rsc = getRscPayload(html)
  const teamsRaw = extractRscArray(rsc, "teams")
  const out: AcbTeam[] = []
  for (const t of teamsRaw) {
    const u = unwrapTeam(t)
    const clubId = Number(u.clubId ?? 0)
    if (!clubId) continue
    out.push({
      sourceId: `acb-${clubId}`,
      name: pickString(u, ["fullName"]) ?? "",
      shortName: pickString(u, ["shortName"]) ?? "",
      abbreviation: pickString(u, ["abbreviatedName"]) ?? "",
      clubId,
      logoUrl: pickString(u, ["logo"]) ?? undefined,
      primaryColor: pickString(u, ["primaryColorHex"]) ?? undefined,
    })
  }
  return out
}

const slugCache = new Map<number, string>()
async function resolveSlug(clubId: number, teams?: AcbTeam[]): Promise<string> {
  if (slugCache.has(clubId)) return slugCache.get(clubId)!
  const list = teams ?? (await fetchTeamsList())
  const t = list.find((x) => x.clubId === clubId)
  if (!t) return `club-${clubId}`
  const slug = t.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const result = `${slug}-${clubId}`
  slugCache.set(clubId, result)
  return result
}

async function fetchRoster(clubId: number): Promise<{
  players: Raw[]
  staff: Raw[]
  clubInfo: AcbClubInfo | null
}> {
  const slug = await resolveSlug(clubId)
  const html = await fetchHtml(
    `${ACB_BASE}${ACB_LIGA}/equipos/${slug}/plantilla`,
  )
  const rsc = getRscPayload(html)
  const roster = extractRscObject(rsc, "currentRoster")
  const players = Array.isArray(roster?.players)
    ? (roster.players as Raw[])
    : []
  const staff = Array.isArray(roster?.staff) ? (roster.staff as Raw[]) : []
  const clubInfo = extractRscObject(rsc, "clubInfo") as AcbClubInfo | null
  return { players, staff, clubInfo }
}

function mapPlayer(raw: Raw, teamSourceId: string): SourcePlayer | null {
  const player = raw.player
  if (!player || typeof player !== "object") return null
  const p = player as Raw
  const id = pickString(p, ["id"])
  const firstName = pickString(p, ["firstName"]) ?? ""
  const lastName = pickString(p, ["lastName"]) ?? ""
  const fullName = `${firstName} ${lastName}`.trim()
  if (!id || !fullName) return null
  const height = pickNumber(raw, ["height"])
  return {
    sourceId: `acb-${id}`,
    fullName,
    birthdate: parseBirthdate(
      pickString(raw, ["birthDate", "birthday", "fechaNacimiento", "born"]),
    ),
    nationality: pickString(raw, ["nationalityCountry"]) ?? undefined,
    position: pickString(p, ["gameRole"]) ?? undefined,
    jerseyNumber: pickString(p, ["shirtNumber"]) ?? undefined,
    age: pickNumber(raw, ["age"]),
    heightCm:
      typeof height === "number" ? height : parseHeightToCm(String(height)),
    teamSourceId,
    photoUrl:
      pickString(p, ["headshotImageNoBackgroundUrl", "headshotImageUrl"]) ??
      undefined,
    licenseType: pickString(raw, ["licensing"]) ?? undefined,
  }
}

function mapCoach(raw: Raw, teamSourceId: string): SourceCoach | null {
  const coach = raw.coach
  if (!coach || typeof coach !== "object") return null
  const c = coach as Raw
  const id = pickString(c, ["id"])
  const firstName = pickString(c, ["firstName"]) ?? ""
  const lastName = pickString(c, ["lastName"]) ?? ""
  const fullName = `${firstName} ${lastName}`.trim()
  if (!id || !fullName) return null
  const role = pickString(c, ["gameRole"]) ?? ""
  const roleLower = role.toLowerCase()
  const normalized: SourceCoach["role"] = roleLower.includes("ayudante")
    ? "assistant_coach"
    : roleLower.includes("preparador") ||
        roleLower.includes("físic") ||
        roleLower.includes("fisio") ||
        roleLower.includes("delegad")
      ? "staff"
      : "head_coach"
  return {
    sourceId: `acb-${id}`,
    fullName,
    role: normalized,
    teamSourceId,
    nationality: pickString(raw, ["nationalityCountry"]) ?? undefined,
    age: pickNumber(raw, ["age"]),
    photoUrl:
      pickString(c, ["headshotImageNoBackgroundUrl", "headshotImageUrl"]) ??
      undefined,
    licenseType: pickString(raw, ["licensing"]) ?? undefined,
  }
}

type Roster = {
  players: SourcePlayer[]
  coaches: SourceCoach[]
  details: {
    city?: string
    foundedYear?: number
    arena?: string
    arenaCapacity?: number
    websiteUrl?: string
  }
}

/**
 * One sync calls fetchTeams, fetchPlayers, fetchCoaches and fetchStats in turn,
 * and each needs the club list and every roster: without this they were read
 * four times over (~150 requests, four minutes). Kept for ten minutes, so the
 * next scheduled sync always reads fresh pages; a failed read is not kept.
 */
const MEMO_MS = 10 * 60_000
const memo = new Map<string, { at: number; value: Promise<unknown> }>()
function memoised<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.value as Promise<T>
  const value = load()
  memo.set(key, { at: Date.now(), value })
  value.catch(() => memo.delete(key))
  return value
}

function fetchAllRosters(teams: AcbTeam[]): Promise<Map<string, Roster>> {
  return memoised("rosters", () => readAllRosters(teams))
}

async function readAllRosters(teams: AcbTeam[]): Promise<Map<string, Roster>> {
  const out = new Map<string, Roster>()
  for (const t of teams) {
    try {
      const r = await fetchRoster(t.clubId)
      const players: SourcePlayer[] = []
      for (const p of r.players) {
        const m = mapPlayer(p, t.sourceId)
        if (m) players.push(m)
      }
      const coaches: SourceCoach[] = []
      for (const c of r.staff) {
        const m = mapCoach(c, t.sourceId)
        if (m) coaches.push(m)
      }
      const ci = r.clubInfo
      const details: Roster["details"] = {
        city: ci?.city ?? ci?.stadiumAddress,
        foundedYear: ci?.foundationYear,
        arena: ci?.stadiumName,
        arenaCapacity: ci?.stadiumCapacity,
        websiteUrl: ci?.webUrl,
      }
      out.set(t.sourceId, { players, coaches, details })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[acb] failed team ${t.sourceId}: ${message}`)
      out.set(t.sourceId, { players: [], coaches: [], details: {} })
    }
  }
  return out
}

/** Normalises ACB team names that differ from the EuroLeague / BR counterpart so
 *  the orchestrator's `slugify` produces the same slug for the same club. */
const SHARED_TEAM_NAME: Partial<Record<string, string>> = {
  Barça: "Barcelona",
  "Kosner Baskonia": "Baskonia",
}

export const acbAdapter: SourceAdapter = {
  id: "acb",
  displayName: SOURCE_META.acb.displayName,
  country: SOURCE_META.acb.country,
  season: SEASON_YEAR,
  seasonCode: SEASON,
  seasonLabel: SOURCE_META.acb.seasonLabel,

  async fetchTeams(): Promise<SourceTeam[]> {
    const teams = await fetchTeamsList()
    const data = await fetchAllRosters(teams)
    return teams.map((t) => {
      const r = data.get(t.sourceId)
      return {
        sourceId: t.sourceId,
        name: SHARED_TEAM_NAME[t.name] ?? t.name,
        shortName: t.shortName,
        country: "ES",
        logoUrl: t.logoUrl,
        primaryColor: t.primaryColor,
        city: r?.details.city,
        foundedYear: r?.details.foundedYear,
        arena: r?.details.arena,
        arenaCapacity: r?.details.arenaCapacity,
        websiteUrl: r?.details.websiteUrl,
      }
    })
  },

  async fetchPlayers(): Promise<SourcePlayer[]> {
    const teams = await fetchTeamsList()
    const data = await fetchAllRosters(teams)
    const all: SourcePlayer[] = []
    for (const r of data.values()) all.push(...r.players)
    return all
  },

  async fetchCoaches(): Promise<SourceCoach[]> {
    const teams = await fetchTeamsList()
    const data = await fetchAllRosters(teams)
    const all: SourceCoach[] = []
    for (const r of data.values()) all.push(...r.coaches)
    return all
  },

  async fetchTeamStats(): Promise<SourceTeamStats[]> {
    const html = await fetchHtml(`${ACB_BASE}${ACB_LIGA}/clasificacion`)
    return parseAcbStandings(getRscPayload(html), SEASON_YEAR)
  },

  async fetchStats(): Promise<ExtractedPlayerStat[]> {
    // Each club's /estadisticas page on acb.com carries its players' season
    // totals, keyed by the same player ids as the roster. These used to come
    // from Basketball-Reference, which answers the production server with a
    // 403 (it jails datacenter IPs) and took the whole ACB sync down with it.
    const teams = await fetchTeamsList()
    const out: ExtractedPlayerStat[] = []
    for (const t of teams) {
      const slug = await resolveSlug(t.clubId, teams)
      const html = await fetchHtml(
        `${ACB_BASE}${ACB_LIGA}/equipos/${slug}/estadisticas`,
      )
      out.push(
        ...parseAcbTeamStats(getRscPayload(html), t.sourceId, SEASON_YEAR),
      )
    }
    return out
  },
}

/**
 * Season totals from a club's /estadisticas RSC payload.
 *
 * The page defaults to the current edition, but between seasons it can still
 * show the last one; its rows carry an `editionId`, and the payload's edition
 * list says which season that id is. Rows from any other season are dropped,
 * which before tip-off leaves the stats empty and the rosters still syncing.
 */
export function parseAcbTeamStats(
  rsc: string,
  teamSourceId: string,
  seasonStartYear: number,
): ExtractedPlayerStat[] {
  const rows = extractRscArray(rsc, "players", (items) =>
    items.some((r) => r && typeof r === "object" && "totals" in r),
  )
  const editionYear = new Map<number, number>()
  for (const m of rsc.matchAll(/"id":(\d+),"seasonStartYear":(\d{4})/g)) {
    editionYear.set(Number(m[1]), Number(m[2]))
  }
  const out: ExtractedPlayerStat[] = []
  for (const row of rows) {
    const p = row.player as Raw | undefined
    const tot = row.totals as Raw | undefined
    const id = p && pickString(p, ["id"])
    if (!p || !id || !tot) continue
    const edition = pickNumber(p, ["editionId"])
    if (edition != null && editionYear.get(edition) !== seasonStartYear)
      continue
    const n = (k: string) => pickNumber(tot, [k]) ?? 0
    const games = n("numGames")
    if (games === 0) continue
    const fga = n("twoPointersAttempted") + n("threePointersAttempted")
    const fta = n("freeThrowsAttempted")
    const pts = n("points")
    out.push({
      playerSourceId: `acb-${id}`,
      season: seasonStartYear,
      teamSourceId,
      gamesPlayed: games,
      // acb.com counts playing time in seconds.
      minutesTotal: Math.round(n("timePlayed") / 60),
      pointsTotal: pts,
      reboundsTotal: n("rebounds"),
      assistsTotal: n("assists"),
      stealsTotal: n("steals"),
      blocksTotal: n("blocks"),
      fgMade: n("twoPointersMade") + n("threePointersMade"),
      fgAttempted: fga,
      threeMade: n("threePointersMade"),
      threeAttempted: n("threePointersAttempted"),
      ftMade: n("freeThrowsMade"),
      ftAttempted: fta,
      offensiveRebounds: n("offensiveRebounds"),
      defensiveRebounds: n("defensiveRebounds"),
      foulsTotal: n("personalFouls"),
      plusMinus: pickNumber(tot, ["plusMinus"]) ?? null,
      per: null,
      trueShootingPct:
        fga + fta > 0
          ? Number((pts / (2 * (fga + 0.44 * fta))).toFixed(3))
          : null,
      winShares: null,
      bpm: null,
    })
  }
  return out
}

/**
 * The Liga Endesa table from /clasificacion: one row per club with games, wins,
 * losses and point totals. Clubs that have not played yet are left out, so a
 * preseason sync writes no table rather than a column of zeros.
 */
export function parseAcbStandings(
  rsc: string,
  seasonStartYear: number,
): SourceTeamStats[] {
  const rows = extractRscArray(rsc, "standings", (items) =>
    items.some((r) => r && typeof r === "object" && "wins" in r),
  )
  // React's flight format writes a repeated object once and later copies as a
  // path to it ("$43:props:data:standings:0:rounds:7:matchData:homeTeam"), so
  // most rows' `team` is such a path into this same array.
  const resolve = (value: unknown): Raw => {
    for (let hops = 0; typeof value === "string" && hops < 5; hops++) {
      const path = value.split(":standings:")[1]
      if (!path) return {}
      let node: unknown = rows
      for (const step of path.split(":")) {
        node = (node as Record<string, unknown> | undefined)?.[step]
      }
      value = node
    }
    return value && typeof value === "object" ? (value as Raw) : {}
  }
  const out: SourceTeamStats[] = []
  for (const row of rows) {
    const clubId = pickNumber(resolve(row.team), ["clubId"])
    const wins = pickNumber(row, ["wins"]) ?? 0
    const losses = pickNumber(row, ["losses"]) ?? 0
    const gp = pickNumber(row, ["matchesPlayed"]) ?? wins + losses
    if (!clubId || gp === 0) continue
    const pointsFor = pickNumber(row, ["pointsFor"])
    const pointsAgainst = pickNumber(row, ["pointsAgainst"])
    out.push({
      teamSourceId: `acb-${clubId}`,
      season: seasonStartYear,
      gamesPlayed: gp,
      wins,
      losses,
      winPct: Number((wins / gp).toFixed(3)),
      pointsFor:
        pointsFor != null ? Number((pointsFor / gp).toFixed(1)) : undefined,
      pointsAgainst:
        pointsAgainst != null
          ? Number((pointsAgainst / gp).toFixed(1))
          : undefined,
      position: pickNumber(row, ["position"]),
    })
  }
  return out
}
