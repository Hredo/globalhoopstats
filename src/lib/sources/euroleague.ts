import {
  type SourceAdapter,
  type SourceCoach,
  type SourcePlayer,
  type ExtractedPlayerStat,
  type SourceTeam,
  type SourceTeamStats,
  SOURCE_META,
} from "@/lib/sources/types"
import { fetchJson } from "@/lib/sources/fetcher"
import {
  classifyShotZone,
  ShotZoneTally,
  type SourceShotZones,
} from "@/lib/sources/shot-zones"

/*
 * EuroLeague comes from the competition's own public API — the JSON feed
 * euroleaguebasketball.net is built on. It used to be scraped from
 * Basketball-Reference, which jails datacenter IPs: from 2026-10-23 every
 * production sync got a 403 on its first request and EuroLeague stopped
 * updating. The official feed also lists every club in the competition (BR's
 * slugs missed the new ones) and real staff, so there is no static fallback.
 */

const API = "https://api-live.euroleague.net"
const SEASON = SOURCE_META.euroleague.seasonCode
const SEASON_YEAR = SOURCE_META.euroleague.season
const V2_SEASON = `${API}/v2/competitions/E/seasons/${SEASON}`
const V3 = `${API}/v3/competitions/E`
/** Shot-by-shot play feed (court coordinates for every field-goal attempt). */
const LIVE = "https://live.euroleague.net/api"
const PAGE = 200

/** Canonical names keyed by EuroLeague club code — keeps slugs stable across sponsor renames. */
const CANONICAL_TEAM_NAMES: Record<string, string> = {
  BER: "ALBA Berlin",
  IST: "Anadolu Efes",
  MCO: "AS Monaco",
  BAS: "Baskonia",
  RED: "Crvena zvezda Meridianbet",
  MIL: "EA7 Emporio Armani Milano",
  BAR: "Barcelona",
  MUN: "Bayern München",
  ULK: "Fenerbahçe Beko",
  ASV: "LDLC ASVEL",
  TEL: "Maccabi Playtika Tel Aviv",
  OLY: "Olympiacos",
  PAN: "Panathinaikos AKTOR",
  PRS: "Paris Basketball",
  PAR: "Partizan Mozzart Bet",
  MAD: "Real Madrid",
  VIR: "Virtus Segafredo Bologna",
  ZAL: "Žalgiris",
  VAL: "Valencia Basket",
}

const POSITION_CODES: Record<string, string> = {
  Guard: "G",
  Forward: "F",
  Center: "C",
}

type ApiClubRef = {
  code: string
  name: string
  abbreviatedName?: string
  images?: { crest?: string }
}

type ApiClub = ApiClubRef & {
  website?: string
  country?: { code: string; name: string }
}

export type ApiPerson = {
  person: {
    code: string
    name: string
    country?: { code: string; name: string } | null
    height?: number
    weight?: number
    birthDate?: string | null
    images?: { headshot?: string } | null
  }
  /**
   * "J" player, "E" head coach, "A" assistant coach. The rest (doctors, team
   * managers, followers, the score crew) is not bench staff and is skipped.
   */
  type: string
  active: boolean
  dorsal?: string
  positionName?: string | null
  club?: ApiClubRef | null
  images?: { headshot?: string } | null
}

export type ApiPlayerStatLine = {
  player: {
    code: string
    name: string
    team: { code: string; name: string }
  }
  gamesPlayed: number
  minutesPlayed: number
  pointsScored: number
  twoPointersMade: number
  twoPointersAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
  totalRebounds: number
  assists: number
  steals: number
  turnovers: number
  blocks: number
  foulsCommited: number
}

type ApiTeamStatLine = {
  team: { code: string }
  gamesPlayed: number
  pointsScored: number
  twoPointersAttempted: number
  threePointersAttempted: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  turnovers: number
}

type ApiStandingRow = {
  position: number
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  pointsFor: number
  pointsAgainst: number
  club: ApiClubRef
}

type ApiRound = { round: number; minGameStartDate: string }

type ApiGame = { gameCode: number; played: boolean; utcDate?: string }

/** One play from live.euroleague.net/api/Points; ids and codes come space-padded. */
export type ApiShotRow = {
  ID_PLAYER?: string
  TEAM?: string
  ID_ACTION?: string
  COORD_X?: number
  COORD_Y?: number
}

const SHOT_ACTIONS = new Set(["2FGM", "2FGA", "3FGM", "3FGA"])

/** Field-goal attempts of one game, bucketed per (player, club) and zone. */
export function euroleagueGameShotZones(rows: ApiShotRow[]): SourceShotZones[] {
  const tally = new ShotZoneTally()
  for (const row of rows) {
    const action = row.ID_ACTION?.trim() ?? ""
    if (!SHOT_ACTIONS.has(action)) continue
    // The play feed prefixes person codes with "P"; the people API does not.
    const player = row.ID_PLAYER?.trim().replace(/^P/, "")
    const team = row.TEAM?.trim()
    const x = Number(row.COORD_X)
    const y = Number(row.COORD_Y)
    if (!player || !team || !Number.isFinite(x) || !Number.isFinite(y)) continue
    const zone = classifyShotZone(x, y, action.startsWith("3"))
    tally.add(player, team, zone, action.endsWith("M") ? 1 : 0)
  }
  return tally.lines()
}

/**
 * "MOTLEY, JOHNATHAN" → "Johnathan Motley". The feed keeps names as
 * "SURNAME, GIVEN" in capitals; the matcher compares case-insensitively, so
 * this only shapes how a brand-new player's name is stored.
 */
export function euroleagueDisplayName(raw: string): string {
  const [surname, given] = raw.split(",").map((s) => s.trim())
  const ordered = given ? `${given} ${surname}` : (surname ?? "")
  return ordered
    .toLowerCase()
    .replace(
      /(^|[\s\-'’.])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    )
    .replace(/\bMc(\p{L})/gu, (_, ch: string) => `Mc${ch.toUpperCase()}`)
    .replace(/\b(Ii|Iii|Iv)$/u, (s) => s.toUpperCase())
    .replace(/\s+/g, " ")
    .trim()
}

export function mapEuroleaguePlayer(p: ApiPerson): SourcePlayer | null {
  if (p.type !== "J" || !p.person?.code) return null
  const fullName = euroleagueDisplayName(p.person.name)
  if (!fullName) return null
  return {
    sourceId: p.person.code,
    fullName,
    birthdate: p.person.birthDate ? p.person.birthDate.slice(0, 10) : undefined,
    nationality: p.person.country?.name || undefined,
    position: p.positionName
      ? (POSITION_CODES[p.positionName] ?? p.positionName)
      : undefined,
    jerseyNumber: p.dorsal || undefined,
    heightCm: p.person.height || undefined,
    weightKg: p.person.weight || undefined,
    // A player who left mid-season stays in the feed as inactive; he keeps his
    // stat line with that club but is no longer on its roster.
    teamSourceId: p.active ? p.club?.code : undefined,
  }
}

export function mapEuroleagueCoach(p: ApiPerson): SourceCoach | null {
  if (p.type !== "E" && p.type !== "A") return null
  if (!p.active || !p.person?.code || !p.club?.code) return null
  const fullName = euroleagueDisplayName(p.person.name)
  if (!fullName) return null
  return {
    sourceId: `${p.club.code}-${p.person.code}`,
    fullName,
    role: p.type === "E" ? "head_coach" : "assistant_coach",
    teamSourceId: p.club.code,
    nationality: p.person.country?.name || undefined,
  }
}

export function mapEuroleagueStatLine(
  s: ApiPlayerStatLine,
): ExtractedPlayerStat {
  const fgm = s.twoPointersMade + s.threePointersMade
  const fga = s.twoPointersAttempted + s.threePointersAttempted
  const tsDenominator = 2 * (fga + 0.44 * s.freeThrowsAttempted)
  return {
    playerSourceId: s.player.code,
    season: SEASON_YEAR,
    teamSourceId: s.player.team.code,
    gamesPlayed: s.gamesPlayed,
    minutesTotal: Math.round(s.minutesPlayed),
    pointsTotal: s.pointsScored,
    reboundsTotal: s.totalRebounds,
    assistsTotal: s.assists,
    stealsTotal: s.steals,
    blocksTotal: s.blocks,
    fgMade: fgm,
    fgAttempted: fga,
    threeMade: s.threePointersMade,
    threeAttempted: s.threePointersAttempted,
    ftMade: s.freeThrowsMade,
    ftAttempted: s.freeThrowsAttempted,
    offensiveRebounds: s.offensiveRebounds,
    defensiveRebounds: s.defensiveRebounds,
    foulsTotal: s.foulsCommited,
    plusMinus: null,
    per: null,
    trueShootingPct:
      tsDenominator > 0
        ? Number((s.pointsScored / tsDenominator).toFixed(3))
        : null,
    winShares: null,
    bpm: null,
  }
}

/** Possession estimate shared by both ends of the floor. */
function possessions(t: ApiTeamStatLine): number {
  const fga = t.twoPointersAttempted + t.threePointersAttempted
  return fga - t.offensiveRebounds + t.turnovers + 0.4 * t.freeThrowsAttempted
}

export function buildEuroleagueTeamStats(
  standings: ApiStandingRow[],
  totals: ApiTeamStatLine[],
  opponents: ApiTeamStatLine[],
): SourceTeamStats[] {
  const totalsByCode = new Map(totals.map((t) => [t.team.code, t]))
  const oppByCode = new Map(opponents.map((t) => [t.team.code, t]))
  const round1 = (n: number) =>
    Number.isFinite(n) ? Number(n.toFixed(1)) : undefined
  return standings.map((row) => {
    const code = row.club.code
    const gp = row.gamesWon + row.gamesLost
    const t = totalsByCode.get(code)
    const o = oppByCode.get(code)
    let offRtg: number | undefined
    let defRtg: number | undefined
    let pace: number | undefined
    if (t && t.gamesPlayed > 0 && possessions(t) > 0) {
      const poss = possessions(t)
      offRtg = round1((100 * t.pointsScored) / poss)
      if (o) defRtg = round1((100 * o.pointsScored) / poss)
      // Possessions per game, scaled from 40 to 48 minutes so it reads on the
      // same scale as the NBA's pace.
      pace = round1(((poss / t.gamesPlayed) * 48) / 40)
    }
    return {
      teamSourceId: code,
      season: SEASON_YEAR,
      gamesPlayed: gp,
      wins: row.gamesWon,
      losses: row.gamesLost,
      winPct: gp > 0 ? Number((row.gamesWon / gp).toFixed(3)) : undefined,
      pointsFor: gp > 0 ? round1(row.pointsFor / gp) : undefined,
      pointsAgainst: gp > 0 ? round1(row.pointsAgainst / gp) : undefined,
      position: row.position,
      pace,
      offRtg,
      defRtg,
      netRtg:
        offRtg != null && defRtg != null ? round1(offRtg - defRtg) : undefined,
    }
  })
}

/** The latest regular-season round that has already tipped off, if any. */
export function currentEuroleagueRound(
  rounds: ApiRound[],
  now = new Date(),
): number | null {
  let latest: number | null = null
  for (const r of rounds) {
    if (
      new Date(r.minGameStartDate) <= now &&
      (latest === null || r.round > latest)
    ) {
      latest = r.round
    }
  }
  return latest
}

/* ---- feed reads, memoised per sync so the five adapter calls share them ---- */

let cache: { at: number; reads: Map<string, Promise<unknown>> } | null = null
const CACHE_MS = 10 * 60_000

function read<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache || Date.now() - cache.at > CACHE_MS)
    cache = { at: Date.now(), reads: new Map() }
  const hit = cache.reads.get(key)
  if (hit) return hit as Promise<T>
  const p = load()
  cache.reads.set(key, p)
  // A failed read must not stick for the next sync.
  p.catch(() => cache?.reads.delete(key))
  return p
}

async function paged<T>(
  url: (offset: number) => string,
  pick: (page: unknown) => T[],
): Promise<T[]> {
  const out: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await fetchJson<{ total?: number }>(url(offset))
    const items = pick(page)
    out.push(...items)
    if (items.length < PAGE || (page.total != null && out.length >= page.total))
      break
  }
  return out
}

const clubs = () =>
  read(
    "clubs",
    async () =>
      (await fetchJson<{ data: ApiClub[] }>(`${V2_SEASON}/clubs?limit=100`))
        .data,
  )

const people = () =>
  read("people", () =>
    paged<ApiPerson>(
      (offset) => `${V2_SEASON}/people?limit=${PAGE}&offset=${offset}`,
      (page) => (page as { data: ApiPerson[] }).data ?? [],
    ),
  )

/*
 * A finished game's shots never change, so each one is fetched once per server
 * process; a sync only pays for the games played since the last one. Games that
 * ended under three hours ago are re-read, in case the feed was still settling.
 */
const finishedGameShots = new Map<string, SourceShotZones[]>()
const SETTLED_MS = 3 * 60 * 60_000

async function seasonShotZones(): Promise<SourceShotZones[]> {
  const games = (
    await fetchJson<{ data: ApiGame[] }>(`${V2_SEASON}/games`)
  ).data.filter((g) => g.played && Number.isFinite(g.gameCode))
  const tally = new ShotZoneTally()
  let failed = 0
  for (const game of games) {
    const key = `${SEASON}:${game.gameCode}`
    let lines = finishedGameShots.get(key)
    if (!lines) {
      try {
        const feed = await fetchJson<{ Rows?: ApiShotRow[] }>(
          `${LIVE}/Points?gamecode=${game.gameCode}&seasoncode=${SEASON}`,
        )
        lines = euroleagueGameShotZones(feed.Rows ?? [])
      } catch (err) {
        failed++
        console.warn(
          `[euroleague] shots for game ${game.gameCode} unavailable: ${err instanceof Error ? err.message : err}`,
        )
        continue
      }
      const ended = game.utcDate ? Date.parse(game.utcDate) : NaN
      if (Number.isFinite(ended) && Date.now() - ended > SETTLED_MS)
        finishedGameShots.set(key, lines)
    }
    tally.addAll(lines)
  }
  // Season totals missing games would overwrite complete numbers with smaller
  // ones; skip the write and let the next sync pick the gaps up.
  if (games.length > 0 && failed / games.length > 0.05)
    throw new Error(`shots missing for ${failed}/${games.length} games`)
  return tally.lines()
}

const v3Stats = (kind: string) =>
  `${V3}/statistics/${kind}?seasonMode=Single&seasonCode=${SEASON}&statisticMode=accumulated`

const playerStats = () =>
  read("playerStats", () =>
    paged<ApiPlayerStatLine>(
      (offset) =>
        `${v3Stats("players/traditional")}&limit=${PAGE}&offset=${offset}`,
      (page) => (page as { players: ApiPlayerStatLine[] }).players ?? [],
    ),
  )

export const euroleagueAdapter: SourceAdapter = {
  id: "euroleague",
  displayName: SOURCE_META.euroleague.displayName,
  country: SOURCE_META.euroleague.country,
  season: SEASON_YEAR,
  seasonCode: SEASON,
  seasonLabel: SOURCE_META.euroleague.seasonLabel,

  async fetchTeams(): Promise<SourceTeam[]> {
    return (await clubs()).map((c) => ({
      sourceId: c.code,
      name: CANONICAL_TEAM_NAMES[c.code] ?? c.name,
      shortName: c.abbreviatedName,
      country: "EU",
      logoUrl: c.images?.crest,
      websiteUrl: c.website || undefined,
    }))
  },

  async fetchPlayers(): Promise<SourcePlayer[]> {
    // One entry per (person, club): prefer the club he is on now.
    const byCode = new Map<string, SourcePlayer>()
    for (const p of await people()) {
      const mapped = mapEuroleaguePlayer(p)
      if (!mapped) continue
      const prior = byCode.get(mapped.sourceId)
      if (!prior || (!prior.teamSourceId && mapped.teamSourceId))
        byCode.set(mapped.sourceId, mapped)
    }
    return [...byCode.values()]
  },

  async fetchStats(): Promise<ExtractedPlayerStat[]> {
    // Before tip-off the feed has no lines: rosters sync, stats arrive later.
    return (await playerStats())
      .filter((s) => s.gamesPlayed > 0)
      .map(mapEuroleagueStatLine)
  },

  async fetchCoaches(): Promise<SourceCoach[]> {
    const seen = new Set<string>()
    const out: SourceCoach[] = []
    for (const p of await people()) {
      const c = mapEuroleagueCoach(p)
      if (!c || seen.has(c.sourceId)) continue
      seen.add(c.sourceId)
      out.push(c)
    }
    return out
  },

  async fetchTeamStats(): Promise<SourceTeamStats[]> {
    const rounds = (
      await fetchJson<{ data: ApiRound[] }>(`${V2_SEASON}/rounds`)
    ).data
    const round = currentEuroleagueRound(rounds)
    if (round === null) return []
    const [standings, totals, opponents] = await Promise.all([
      fetchJson<{ teams: ApiStandingRow[] }>(
        `${V3}/seasons/${SEASON}/rounds/${round}/basicstandings`,
      ),
      fetchJson<{ teams: ApiTeamStatLine[] }>(
        `${v3Stats("teams/traditional")}&limit=100`,
      ),
      fetchJson<{ teams: ApiTeamStatLine[] }>(
        `${v3Stats("teams/opponentsTraditional")}&limit=100`,
      ),
    ])
    return buildEuroleagueTeamStats(
      standings.teams ?? [],
      totals.teams ?? [],
      opponents.teams ?? [],
    )
  },

  fetchShotZones: seasonShotZones,
}
