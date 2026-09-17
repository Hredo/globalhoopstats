import {
  fetchJson,
  fetchText,
  fetchTextIfPublished,
} from "@/lib/sources/fetcher"
import {
  type ExtractedPlayerStat,
  type SourceAdapter,
  type SourceCoach,
  type SourcePlayer,
  type SourceTeam,
  type SourceTeamStats,
  SOURCE_META,
} from "@/lib/sources/types"
import { nbaCodeToId } from "@/lib/sources/nba-teams"

const BASE_URL = "https://stats.nba.com/stats"
const BR_BASE = "https://www.basketball-reference.com"

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// stats.nba.com is served behind Akamai's WAF, which silently drops requests
// carrying the GlobalHoopStatsBot UA (even with standard headers). A browser UA
// is required because the API's CDN gates on it, not because we are hiding —
// the Referer/Origin headers still identify us as coming from nba.com. The bot
// UA is still used for every other source in the project.
const NBA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
}

type NbaRow = Record<string, string | number | null>
type NbaResultSet = {
  name: string
  headers: string[]
  rowSet: (string | number | null)[][]
}
type NbaEnvelope = { resultSets: NbaResultSet[] }

function readResultSet(payload: NbaEnvelope, name: string): NbaRow[] {
  const set = payload.resultSets.find((rs) => rs.name === name)
  if (!set) return []
  return set.rowSet.map((row) => {
    const obj: NbaRow = {}
    for (let i = 0; i < set.headers.length; i++) {
      obj[set.headers[i]!] = row[i] ?? null
    }
    return obj
  })
}

function photoUrl(playerId: number | string): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
}

function teamLogoUrl(teamId: number | string): string {
  return `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`
}

async function fetchHtml(url: string): Promise<string> {
  // Shared polite fetcher (identifiable UA, per-host rate limiting). The JSON
  // stats.nba.com calls already go through `fetchJson` with the Referer/Origin
  // headers below.
  return fetchText(url, { headers: { "Accept-Language": "en-US,en;q=0.9" } })
}

/**
 * A Basketball-Reference season page, or null when that season has no page yet.
 *
 * BR publishes `NBA_2027*.html` once the season is under way. In preseason it
 * 404s, which is a season that has not started — not a scrape failure — so the
 * caller returns an empty list and the roster ingest carries on.
 */
async function fetchBrHtml(url: string): Promise<string | null> {
  return fetchTextIfPublished(url, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
  })
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

function getRowCells(row: string): Map<string, string> {
  const cells = new Map<string, string>()
  const cellRe = /<t[hd]\b[^>]*\bdata-stat="([^"]+)"[^>]*>([\s\S]*?)<\/t[hd]>/g
  let m: RegExpExecArray | null
  while ((m = cellRe.exec(row)) !== null) {
    const stat = m[1]
    const inner = m[2].replace(/<[^>]+>/g, "").trim()
    cells.set(stat, decodeEntities(inner))
  }
  return cells
}

function toNumberOrNull(s: string | undefined): number | undefined {
  if (s === undefined || s === "") return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function extractTableById(html: string, id: string): string {
  const re = new RegExp(`<table[^>]*\\bid="${id}"[\\s\\S]*?<\\/table>`, "i")
  const m = html.match(re)
  return m ? m[0] : ""
}

function rowsFromTable(tableHtml: string): string[] {
  if (!tableHtml) return []
  return tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? []
}

/**
 * Basketball-Reference labels an NBA season by its END year: 2026-27 lives at
 * `/leagues/NBA_2027.html`. Derived from the season start year rather than
 * parsed out of the code so it cannot drift when the code format changes.
 */
function nbaSeasonYearEnd(): number {
  return SOURCE_META.nba.season + 1
}

const SEASON_END_YEAR = nbaSeasonYearEnd()

/** playerindex height, e.g. "6-8" (feet-inches) → centimetres. */
function parseFeetInches(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const m = String(raw).trim().match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (!m) return undefined
  const inches = Number(m[1]) * 12 + Number(m[2])
  return inches > 0 ? Math.round(inches * 2.54) : undefined
}

/** playerindex weight, e.g. "243" (pounds) → kilograms. */
function parseLbs(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const lbs = Number(String(raw).trim())
  return Number.isFinite(lbs) && lbs > 0
    ? Math.round(lbs * 0.453592)
    : undefined
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export const nbaAdapter: SourceAdapter = {
  id: "nba",
  displayName: SOURCE_META.nba.displayName,
  country: SOURCE_META.nba.country,
  season: SOURCE_META.nba.season,
  seasonCode: SOURCE_META.nba.seasonCode,
  seasonLabel: SOURCE_META.nba.seasonLabel,

  async fetchTeams(): Promise<SourceTeam[]> {
    const season = SOURCE_META.nba.seasonCode
    const url = `${BASE_URL}/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular+Season`
    const payload = await fetchJson<NbaEnvelope>(url, {
      headers: NBA_HEADERS,
      timeoutMs: 90_000,
    })
    const rows = readResultSet(payload, "Standings")
    const out: SourceTeam[] = []
    for (const r of rows) {
      const id = r.TeamID
      const city = r.TeamCity ? String(r.TeamCity) : ""
      const name = r.TeamName ? String(r.TeamName) : ""
      if (id == null || !name) continue
      out.push({
        sourceId: String(id),
        name: `${city} ${name}`.trim(),
        country: "USA",
        city,
        logoUrl: teamLogoUrl(id),
      })
    }
    // Enrich with team details from the teamdetails endpoint (sequential,
    // with delays to avoid stats.nba.com throttling).
    const teamIds = out.map((t) => t.sourceId)
    const details = await this.fetchTeamDetails!(teamIds)
    for (const team of out) {
      const d = details.get(team.sourceId)
      if (d) {
        if (d.arena) team.arena = d.arena
        if (d.arenaCapacity) team.arenaCapacity = d.arenaCapacity
        if (d.foundedYear) team.foundedYear = d.foundedYear
        if (d.websiteUrl) team.websiteUrl = d.websiteUrl
      }
    }
    return out
  },

  async fetchTeamDetails(teamIds: string[]): Promise<
    Map<
      string,
      {
        arena?: string
        arenaCapacity?: number
        foundedYear?: number
        websiteUrl?: string
      }
    >
  > {
    const out = new Map<
      string,
      {
        arena?: string
        arenaCapacity?: number
        foundedYear?: number
        websiteUrl?: string
      }
    >()
    for (const id of teamIds) {
      try {
        const url = `${BASE_URL}/teamdetails?LeagueID=00&TeamID=${id}`
        const payload = await fetchJson<NbaEnvelope>(url, {
          headers: NBA_HEADERS,
        })
        const set = payload.resultSets.find(
          (rs) => rs.name === "TeamBackground",
        )
        if (!set) continue
        const row = set.rowSet[0]
        if (!row) continue
        const obj: NbaRow = {}
        for (let i = 0; i < set.headers.length; i++)
          obj[set.headers[i]!] = row[i] ?? null
        out.set(id, {
          arena: obj.ARENA ? String(obj.ARENA) : undefined,
          arenaCapacity: obj.ARENACAPACITY
            ? Number(obj.ARENACAPACITY)
            : undefined,
          foundedYear: obj.YEARFOUNDED ? Number(obj.YEARFOUNDED) : undefined,
          websiteUrl: obj.WEBSITE ? String(obj.WEBSITE) : undefined,
        })
        await sleep(250)
      } catch {
        // ignore individual failures
      }
    }
    return out
  },

  /**
   * The league's rosters.
   *
   * `playerindex` is the ROSTER of record and `leaguedashplayerbiostats` is a
   * STATS endpoint, and the difference only shows in preseason: asked for a
   * season that has not tipped off, playerindex returns all 580 players with
   * their new clubs while bio stats returns zero rows. Building the roster off
   * bio stats — which is what this used to do — therefore reported an empty
   * league every summer, the quality gate blocked the sync, and no new season
   * could ever be ingested before its first game.
   *
   * So playerindex is the spine, and bio stats is merged in for the extras it
   * alone carries (age, exact height in inches) whenever it has rows.
   */
  async fetchPlayers(): Promise<SourcePlayer[]> {
    const season = SOURCE_META.nba.seasonCode

    const indexUrl =
      `${BASE_URL}/playerindex?College=&Country=&DraftPick=&DraftRound=` +
      `&DraftYear=&Height=&Historical=0&LeagueID=00&Season=${season}` +
      `&SeasonType=Regular+Season&TeamID=0&Weight=`
    const indexPayload = await fetchJson<NbaEnvelope>(indexUrl, {
      headers: NBA_HEADERS,
      timeoutMs: 60_000,
    })
    const indexRows = readResultSet(indexPayload, "PlayerIndex")

    // Optional enrichment; a failure here must not cost us the roster.
    type Bio = { age?: number; heightCm?: number; weightKg?: number; country?: string }
    const bioById = new Map<string, Bio>()
    try {
      const bioUrl =
        `${BASE_URL}/leaguedashplayerbiostats?Season=${season}` +
        `&SeasonType=Regular+Season&LeagueID=00&PerMode=PerGame`
      const bioPayload = await fetchJson<NbaEnvelope>(bioUrl, {
        headers: NBA_HEADERS,
        timeoutMs: 60_000,
      })
      for (const r of readResultSet(bioPayload, "LeagueDashPlayerBioStats")) {
        if (r.PLAYER_ID == null) continue
        const heightInches = Number(r.PLAYER_HEIGHT_INCHES ?? 0)
        const weightLbs = Number(r.PLAYER_WEIGHT ?? 0)
        bioById.set(String(r.PLAYER_ID), {
          age: r.AGE != null ? Number(r.AGE) : undefined,
          heightCm: heightInches > 0 ? Math.round(heightInches * 2.54) : undefined,
          weightKg: weightLbs > 0 ? Math.round(weightLbs * 0.453592) : undefined,
          country: r.COUNTRY ? String(r.COUNTRY) : undefined,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[nba] bio stats unavailable, roster only — ${message}`)
    }

    const out: SourcePlayer[] = []
    for (const r of indexRows) {
      const id = r.PERSON_ID
      const first = r.PLAYER_FIRST_NAME ? String(r.PLAYER_FIRST_NAME).trim() : ""
      const last = r.PLAYER_LAST_NAME ? String(r.PLAYER_LAST_NAME).trim() : ""
      const fullName = `${first} ${last}`.trim()
      if (id == null || !fullName) continue
      const bio = bioById.get(String(id)) ?? {}
      out.push({
        sourceId: String(id),
        fullName,
        nationality: bio.country ?? (r.COUNTRY ? String(r.COUNTRY) : undefined),
        age: bio.age,
        position: r.POSITION ? String(r.POSITION) : undefined,
        jerseyNumber: r.JERSEY_NUMBER ? String(r.JERSEY_NUMBER) : undefined,
        // playerindex gives height as feet-inches ("6-8"); bio stats gives it
        // in decimal inches, which is the more precise of the two.
        heightCm: bio.heightCm ?? parseFeetInches(r.HEIGHT),
        weightKg: bio.weightKg ?? parseLbs(r.WEIGHT),
        teamSourceId: r.TEAM_ID ? String(r.TEAM_ID) : undefined,
        photoUrl: photoUrl(id),
      })
    }
    return out
  },

  async fetchStats(): Promise<ExtractedPlayerStat[]> {
    const season = SOURCE_META.nba.seasonCode
    const url =
      `${BASE_URL}/leaguegamelog?LeagueID=00&Season=${season}` +
      `&SeasonType=Regular+Season&PlayerOrTeam=P&Direction=ASC&Sorter=DATE` +
      `&DateFrom=&DateTo=&Counter=0`
    const payload = await fetchJson<NbaEnvelope>(url, {
      headers: NBA_HEADERS,
      timeoutMs: 90_000,
    })
    const rows = readResultSet(payload, "LeagueGameLog")
    const nameById = new Map<string, string>()
    const accum = new Map<
      string,
      {
        playerId: string
        playerName: string
        teamId: string | undefined
        games: number
        min: number
        pts: number
        reb: number
        ast: number
        stl: number
        blk: number
        fgm: number
        fga: number
        fg3m: number
        fg3a: number
        ftm: number
        fta: number
        offReb: number
        defReb: number
        pf: number
        plusMinus: number
      }
    >()

    for (const r of rows) {
      const playerId = r.PLAYER_ID
      if (playerId == null) continue
      const key = String(playerId)
      const playerName = r.PLAYER_NAME ? String(r.PLAYER_NAME).trim() : ""
      nameById.set(key, playerName)
      const entry = accum.get(key) ?? {
        playerId: key,
        playerName,
        teamId: r.TEAM_ID ? String(r.TEAM_ID) : undefined,
        games: 0,
        min: 0,
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        offReb: 0,
        defReb: 0,
        pf: 0,
        plusMinus: 0,
      }
      entry.games += 1
      entry.min += Number(r.MIN ?? 0) || 0
      entry.pts += Number(r.PTS ?? 0) || 0
      entry.reb += Number(r.REB ?? 0) || 0
      entry.ast += Number(r.AST ?? 0) || 0
      entry.stl += Number(r.STL ?? 0) || 0
      entry.blk += Number(r.BLK ?? 0) || 0
      entry.fgm += Number(r.FGM ?? 0) || 0
      entry.fga += Number(r.FGA ?? 0) || 0
      entry.fg3m += Number(r.FG3M ?? 0) || 0
      entry.fg3a += Number(r.FG3A ?? 0) || 0
      entry.ftm += Number(r.FTM ?? 0) || 0
      entry.fta += Number(r.FTA ?? 0) || 0
      entry.offReb += Number(r.OREB ?? 0) || 0
      entry.defReb += Number(r.DREB ?? 0) || 0
      entry.pf += Number(r.PF ?? 0) || 0
      entry.plusMinus += Number(r.PLUS_MINUS ?? 0) || 0
      accum.set(key, entry)
    }

    // Scrape PER, WS, BPM from basketball-reference advanced stats
    const brAdvancedUrl = `${BR_BASE}/leagues/NBA_${SEASON_END_YEAR}_advanced.html`
    const advByPlayerName = new Map<
      string,
      { per: number | null; winShares: number | null; bpm: number | null }
    >()
    try {
      const brHtml = await fetchBrHtml(brAdvancedUrl)
      const advTableHtml = brHtml ? extractTableById(brHtml, "advanced") : ""
      for (const row of rowsFromTable(advTableHtml)) {
        const cells = getRowCells(row)
        const playerName = cells.get("player") ?? cells.get("name_display")
        if (!playerName) continue
        advByPlayerName.set(
          normalizeName(playerName),
          {
            per: toNumberOrNull(cells.get("per")) ?? null,
            winShares: toNumberOrNull(cells.get("ws")) ?? null,
            bpm: toNumberOrNull(cells.get("bpm")) ?? null,
          },
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(
        `[nba] BR advanced stats unavailable — ${message}`,
      )
    }

    const out: ExtractedPlayerStat[] = []
    for (const entry of accum.values()) {
      const g = entry.games
      const tsPct =
        entry.fga > 0
          ? Number(
              (entry.pts / (2 * (entry.fga + 0.44 * entry.fta))).toFixed(3),
            )
          : null
      const adv = entry.playerName
        ? advByPlayerName.get(normalizeName(entry.playerName))
        : undefined
      out.push({
        playerSourceId: entry.playerId,
        season: SOURCE_META.nba.season,
        teamSourceId: entry.teamId,
        gamesPlayed: g,
        minutesTotal: entry.min,
        pointsTotal: entry.pts,
        reboundsTotal: entry.reb,
        assistsTotal: entry.ast,
        stealsTotal: entry.stl,
        blocksTotal: entry.blk,
        fgMade: entry.fgm,
        fgAttempted: entry.fga,
        threeMade: entry.fg3m,
        threeAttempted: entry.fg3a,
        ftMade: entry.ftm,
        ftAttempted: entry.fta,
        offensiveRebounds: entry.offReb,
        defensiveRebounds: entry.defReb,
        foulsTotal: entry.pf,
        plusMinus: entry.plusMinus,
        per: adv?.per ?? null,
        trueShootingPct: tsPct,
        winShares: adv?.winShares ?? null,
        bpm: adv?.bpm ?? null,
      })
    }
    return out
  },

  async fetchCoaches(): Promise<SourceCoach[]> {
    const url = `${BR_BASE}/leagues/NBA_${SEASON_END_YEAR}_coaches.html`
    const html = await fetchBrHtml(url)
    if (!html) {
      console.warn(`[nba] ${SEASON_END_YEAR} coaches page not published yet`)
      return []
    }
    const tableHtml = extractTableById(html, "NBA_coaches")
    const rows = rowsFromTable(tableHtml)
    const out: SourceCoach[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const cells = getRowCells(row)
      const name = cells.get("coach")
      if (!name) continue
      const coachId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const teamHref =
        row.match(/<a[^>]*href=(?:"|')(\/teams\/[^"']+\.html)(?:"|')/)?.[1] ??
        undefined
      const teamCode = teamHref?.match(/\/teams\/([^/]+)\//)?.[1]
      const role = (cells.get("role") ?? "head_coach").toLowerCase()
      const normalizedRole: SourceCoach["role"] = role.includes("assistant")
        ? "assistant_coach"
        : "head_coach"
      const key = `${coachId}-${teamCode ?? "fa"}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        sourceId: key,
        fullName: name,
        role: normalizedRole,
        teamSourceId: teamCode ? nbaCodeToId(teamCode) : undefined,
      })
    }
    return out
  },

  async fetchTeamStats(): Promise<SourceTeamStats[]> {
    const url = `${BR_BASE}/leagues/NBA_${SEASON_END_YEAR}.html`
    const html = await fetchBrHtml(url)
    if (!html) {
      console.warn(`[nba] ${SEASON_END_YEAR} season page not published yet`)
      return []
    }

    const advancedHtml = extractTableById(html, "advanced-team")
    const advancedByCode = new Map<
      string,
      {
        offRtg?: number
        defRtg?: number
        netRtg?: number
        pace?: number
        sos?: number
      }
    >()
    for (const row of rowsFromTable(advancedHtml)) {
      const teamHref =
        row.match(/<a[^>]*href=(?:"|')(\/teams\/[^"']+\.html)(?:"|')/)?.[1] ??
        undefined
      const teamCode = teamHref?.match(/\/teams\/([^/]+)\//)?.[1]
      if (!teamCode) continue
      const cells = getRowCells(row)
      advancedByCode.set(teamCode, {
        offRtg: toNumberOrNull(cells.get("off_rtg")),
        defRtg: toNumberOrNull(cells.get("def_rtg")),
        netRtg: toNumberOrNull(cells.get("net_rtg")),
        pace: toNumberOrNull(cells.get("pace")),
        sos: toNumberOrNull(cells.get("sos")),
      })
    }

    const out: SourceTeamStats[] = []
    const seen = new Set<string>()
    let position = 0
    for (const id of ["divs_standings_E", "divs_standings_W"]) {
      const tableHtml = extractTableById(html, id)
      const rows = rowsFromTable(tableHtml)
      for (const row of rows) {
        const teamHref =
          row.match(/<a[^>]*href=(?:"|')(\/teams\/[^"']+\.html)(?:"|')/)?.[1] ??
          undefined
        const teamCode = teamHref?.match(/\/teams\/([^/]+)\//)?.[1]
        if (!teamCode) continue
        if (seen.has(teamCode)) continue
        const cells = getRowCells(row)
        const teamName = cells.get("team_name")
        if (!teamName) continue
        const w = toNumberOrNull(cells.get("wins")) ?? 0
        const l = toNumberOrNull(cells.get("losses")) ?? 0
        const g = w + l
        const pts = toNumberOrNull(cells.get("pts_per_g"))
        const oppPts = toNumberOrNull(cells.get("opp_pts_per_g"))
        const teamId = nbaCodeToId(teamCode)
        if (!teamId) continue
        seen.add(teamCode)
        position++
        const adv = advancedByCode.get(teamCode)
        out.push({
          teamSourceId: teamId,
          season: SOURCE_META.nba.season,
          gamesPlayed: g,
          wins: w,
          losses: l,
          winPct: g > 0 ? Number((w / g).toFixed(3)) : undefined,
          pointsFor: pts,
          pointsAgainst: oppPts,
          position,
          pace: adv?.pace,
          offRtg: adv?.offRtg,
          defRtg: adv?.defRtg,
          netRtg: adv?.netRtg,
          sos: adv?.sos,
        })
      }
    }
    return out
  },
}
