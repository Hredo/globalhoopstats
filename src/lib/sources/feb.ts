import {
  type SourceAdapter,
  type SourceCoach,
  type SourcePlayer,
  type SourceTeam,
  type SourceTeamStats,
  type ExtractedPlayerStat,
} from "@/lib/sources/types"
import { fetchText as politeFetch } from "@/lib/sources/fetcher"
import { parseBirthdate, parseHeightToCm, parseWeightToKg } from "@/lib/sync/slug"

const BASE = "https://baloncestoenvivo.feb.es"
const SEASON_YEAR = 2025
const SEASON_T = "2025"

// Enrichment adds one Equipo.aspx request per team plus one Jugador.aspx
// request per leftover player, so pace those at roughly one every 2-3s.
const POLITE_DELAY_MS = 1800
const POLITE_JITTER_MS = 1200

function politePause(): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, POLITE_DELAY_MS + Math.random() * POLITE_JITTER_MS),
  )
}

export type FebConfig = {
  id: "leb-oro" | "leb-plata" | "eba"
  displayName: string
  g: number
  nm: string
}

type Hiddens = Record<string, string>
type Select = {
  name: string
  options: Array<{ value: string; text: string; selected: boolean }>
}

async function fetchText(url: string, init?: { method?: string; body?: string }): Promise<string> {
  // Routed through the shared polite fetcher. The ASP.NET viewstate POSTs keep
  // working: method/body pass through and the Content-Type for form bodies is
  // set by the core fetcher. The local `politePause()` between enrichment
  // requests still applies on top, so FEB stays very lightly loaded.
  return politeFetch(url, {
    method: init?.method,
    body: init?.body,
    headers: { "Accept-Language": "es-ES,es;q=0.9" },
  })
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ").replace(/&uuml;/g, "ü")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function parseHiddens(html: string): Hiddens {
  const out: Hiddens = {}
  for (const tag of html.match(/<input[^>]*type="hidden"[^>]*>/gi) ?? []) {
    const name = tag.match(/name="([^"]+)"/)?.[1]
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? ""
    if (name) out[name] = decodeEntities(value)
  }
  return out
}

function parseSelects(html: string): Select[] {
  const out: Select[] = []
  const re = /<select[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const options: Select["options"] = []
    const ore = /<option([^>]*)>([\s\S]*?)<\/option>/gi
    let om: RegExpExecArray | null
    while ((om = ore.exec(m[2]!)) !== null) {
      options.push({
        value: om[1]!.match(/value="([^"]*)"/)?.[1] ?? "",
        text: decodeEntities(om[2]!.replace(/<[^>]+>/g, "").trim()),
        selected: /\bselected\b/i.test(om[1]!),
      })
    }
    out.push({ name: m[1]!, options })
  }
  return out
}

function findSelect(selects: Select[], predicate: (s: Select) => boolean) {
  return selects.find(predicate)
}

const isTeamOption = (value: string) => /^\d+$/.test(value) && Number(value) > 100000

function teamSelect(selects: Select[]) {
  return findSelect(
    selects,
    (s) => s.options.some((o) => o.value === "-1" && /equipo/i.test(o.text)) &&
      s.options.some((o) => isTeamOption(o.value)),
  )
}

function groupSelect(selects: Select[]): Select | undefined {
  return selects.find((s) => s.name.endsWith("gruposDropDownList"))
}

/**
 * The regular-season group(s) of a competition. Segunda FEB splits into two
 * conferences ("Liga Regular ESTE/OESTE") and Tercera FEB into ten
 * regional groups ("Liga Regular A-A" … "E-B"); Primera FEB has a single
 * "Liga Regular Único". We scrape all of them — the playoff/permanencia phases
 * the dropdown also lists only repeat a handful of qualified teams.
 */
function regularGroups(selects: Select[]): Array<{ value: string; text: string }> {
  return (groupSelect(selects)?.options ?? []).filter((o) =>
    /liga\s+regular/i.test(o.text) && /^-?\d+$/.test(o.value),
  )
}

function buildPostBody(hiddens: Hiddens, selects: Select[], eventTarget: string, overrides: Record<string, string>): string {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(hiddens)) body.set(k, v)
  for (const s of selects) {
    const selected = s.options.find((o) => o.selected) ?? s.options[0]
    body.set(s.name, selected?.value ?? "")
  }
  for (const [k, v] of Object.entries(overrides)) body.set(k, v)
  body.set("__EVENTTARGET", eventTarget)
  body.set("__EVENTARGUMENT", "")
  return body.toString()
}

function toNum(s: string | undefined): number | undefined {
  if (!s) return undefined
  const n = Number(s.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : undefined
}

function titleCaseEs(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])([\p{L}])/gu, (_, sep, ch) => sep + ch.toUpperCase())
}

function formatFebName(raw: string): string {
  const clean = decodeEntities(raw.replace(/<[^>]+>/g, "").trim())
  const parts = clean.split(",")
  const reordered = parts.length >= 2 ? `${parts[1]!.trim()} ${parts[0]!.trim()}` : clean
  return titleCaseEs(reordered.replace(/\s+/g, " ").trim())
}

function tdText(row: string, cls: string): string | undefined {
  const m = row.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)</td>`, "i"))
  if (!m) return undefined
  return decodeEntities(m[1]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || undefined
}

type FebPlayer = {
  playerId: string; fullName: string; teamId: string; teamName: string
  position?: string; heightCm?: number; weightKg?: number; nationality?: string
  birthdate?: string; games?: number; ppg?: number; pointsTotal?: number
}

/** rankingsDropDownList values on rankings.aspx, keyed by what they fill. */
const STAT_CATEGORIES = {
  rebounds: "1",
  offensiveRebounds: "2",
  defensiveRebounds: "3",
  assists: "4",
  steals: "5",
  blocks: "7",
  fouls: "11",
  minutes: "13",
  twoPoint: "14",
  threePoint: "15",
  freeThrow: "16",
} as const

type StatCategoryKey = keyof typeof STAT_CATEGORIES

type CategoryLine = { total?: number; made?: number; attempted?: number }

type FebStatLines = Map<string, Partial<Record<StatCategoryKey, CategoryLine>>>

type FebBio = Pick<
  FebPlayer,
  "position" | "heightCm" | "weightKg" | "nationality" | "birthdate"
>

type FebCoach = { fullName: string; photoUrl?: string; birthdate?: string }

type FebTeamMeta = { city?: string; logoUrl?: string; coach?: FebCoach }

/** FEB renders countries/cities/coach names in ALL CAPS; title-case those. */
function fromCaps(s: string | undefined): string | undefined {
  if (!s) return undefined
  return s === s.toUpperCase() ? titleCaseEs(s) : s
}

/** "Camí de Bintaufa, 18 07702 Mahón (Illes Balears)" → "Mahón". */
function cityFromAddress(address: string | undefined): string | undefined {
  const m = address?.match(/\b\d{5}\s+([^(]+?)\s*(?:\(|$)/)
  return m ? fromCaps(m[1]!.trim()) : undefined
}

function ageFromBirthdate(iso: string | undefined): number | undefined {
  if (!iso) return undefined
  const birth = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(birth.getTime())) return undefined
  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--
  return age > 0 && age < 100 ? age : undefined
}

function mergeBio(p: FebPlayer, bio: FebBio): void {
  p.position ??= bio.position
  p.heightCm ??= bio.heightCm
  p.weightKg ??= bio.weightKg
  p.nationality ??= bio.nationality
  p.birthdate ??= bio.birthdate
}

function parseRoster(html: string, teamId: string, teamName: string): FebPlayer[] {
  const out: FebPlayer[] = []
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rm[1]!
    const nameM = row.match(
      /class="nombre jugador"[\s\S]*?Jugador\.aspx\?i=\d+&(?:amp;)?c=(\d+)[^>]*>\s*([^<]+?)\s*<\/a>/i,
    )
    if (!nameM) continue
    const fullName = formatFebName(nameM[2]!)
    if (!fullName) continue
    out.push({
      playerId: nameM[1]!, fullName, teamId, teamName,
      position: tdText(row, "puesto"),
      heightCm: tdText(row, "altura") ? parseHeightToCm(tdText(row, "altura")!) : undefined,
      nationality: tdText(row, "nacionalidad"),
      games: toNum(row.match(/class="partidos"[\s\S]*?<span[^>]*>\s*([\d.,]+)/i)?.[1]),
      ppg: toNum(row.match(/class="media"[\s\S]*?<span[^>]*>\s*([\d.,]+)/i)?.[1]),
      pointsTotal: toNum(row.match(/class="cantidad"[\s\S]*?<span[^>]*>\s*([\d.,]+)/i)?.[1]),
    })
  }
  return out
}

/**
 * Ranking rows for one (category, team) postback. The "cantidad" cell holds
 * the season total — for shooting categories it reads "made / attempted".
 */
function parseCategoryRows(html: string): Map<string, CategoryLine> {
  const out = new Map<string, CategoryLine>()
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rm[1]!
    const idM = row.match(/class="nombre jugador"[\s\S]*?Jugador\.aspx\?i=\d+&(?:amp;)?c=(\d+)/i)
    if (!idM) continue
    const cell = row.match(/class="cantidad"[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/i)?.[1]
    if (!cell) continue
    const split = cell.match(/([\d.,]+)\s*\/\s*([\d.,]+)/)
    const clock = cell.match(/^(\d+):(\d{2})$/)
    if (split) {
      out.set(idM[1]!, { made: toNum(split[1]), attempted: toNum(split[2]) })
    } else if (clock) {
      // Minutes render as "MIN:SS" totals.
      out.set(idM[1]!, { total: Math.round(Number(clock[1]) + Number(clock[2]) / 60) })
    } else {
      const total = toNum(cell)
      if (total !== undefined) out.set(idM[1]!, { total })
    }
  }
  return out
}

type PointLine = { games: number; ppg: number | undefined }

function parsePointsRanking(html: string): Map<string, PointLine> {
  const out = new Map<string, PointLine>()
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rm[1]!
    const nameM = row.match(/class="nombre jugador"[\s\S]*?Jugador\.aspx\?i=\d+&(?:amp;)?c=(\d+)/i)
    if (!nameM) continue
    const games = toNum(row.match(/class="partidos"[\s\S]*?<span[^>]*>\s*([\d.,]+)/i)?.[1])
    const ppg = toNum(row.match(/class="media"[\s\S]*?<span[^>]*>\s*([\d.,]+)/i)?.[1])
    if (games && games > 0) out.set(nameM[1]!, { games, ppg })
  }
  return out
}

/**
 * Equipo.aspx roster table — the only ranking-adjacent page that carries the
 * bio columns (puesto/fecha nacimiento/nacionalidad/altura/peso) the rankings
 * table lacks. Rows are keyed by the same c= license id used everywhere else.
 */
function parseTeamRoster(html: string): Map<string, FebBio> {
  const out = new Map<string, FebBio>()
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rm[1]!
    const idM = row.match(/class="nombre jugador"[\s\S]*?Jugador\.aspx\?i=\d+&(?:amp;)?c=(\d+)/i)
    if (!idM) continue
    out.set(idM[1]!, {
      position: tdText(row, "puesto"),
      heightCm: parseHeightToCm(tdText(row, "altura")),
      weightKg: parseWeightToKg(tdText(row, "peso")),
      nationality: fromCaps(tdText(row, "nacionalidad")),
      birthdate: parseBirthdate(tdText(row, "fecha nacimiento")),
    })
  }
  return out
}

/** Club logo, city (from the club address) and head coach on Equipo.aspx. */
function parseTeamMeta(html: string): FebTeamMeta {
  const logo = html.match(/id="[^"]*logoEquipoImage"[^>]*src="([^"]+)"/)?.[1]
  const address = html.match(/id="[^"]*_direccionLabel"[^>]*>([\s\S]*?)<\/span>/)?.[1]
  const meta: FebTeamMeta = {
    logoUrl: logo ? decodeEntities(logo) : undefined,
    city: cityFromAddress(
      address
        ? decodeEntities(address.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
        : undefined,
    ),
  }
  const boxIdx = html.indexOf('"box-entrenador"')
  if (boxIdx >= 0) {
    const seg = html.slice(boxIdx, boxIdx + 2500)
    const name = seg.match(/<div class="nombre">([^<]+)<\/div>/i)?.[1]
    const photoC = seg.match(/Foto\.aspx\?c=(\d+)/i)?.[1]
    if (name) {
      meta.coach = {
        fullName: titleCaseEs(decodeEntities(name).replace(/\s+/g, " ").trim()),
        photoUrl: photoC ? `https://imagenes.feb.es/Foto.aspx?c=${photoC}` : undefined,
        birthdate: parseBirthdate(seg.match(/<div class="fecha nacimiento">([^<]*)<\/div>/i)?.[1]),
      }
    }
  }
  return meta
}

/**
 * Jugador.aspx bio box: <div class="nodo"><span class="label">Altura</span>
 * <span class="string">192 cm</span></div>. Empty values render as " cm" /
 * " Kg" / "", which the parse helpers all reject.
 */
function parsePlayerPage(html: string): FebBio {
  const fields = new Map<string, string>()
  const re = /<span[^>]*class="label"[^>]*>\s*([^<]+?)\s*<\/span>\s*<span[^>]*class="string"[^>]*>([\s\S]*?)<\/span>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const value = decodeEntities(m[2]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    if (value) fields.set(decodeEntities(m[1]!).trim().toLowerCase(), value)
  }
  return {
    position: fields.get("puesto"),
    heightCm: parseHeightToCm(fields.get("altura")),
    weightKg: parseWeightToKg(fields.get("peso")),
    nationality: fromCaps(fields.get("nacionalidad")),
    birthdate: parseBirthdate(fields.get("fecha nacimiento")),
  }
}

type FebData = {
  players: FebPlayer[]
  points: Map<string, PointLine>
  teamMeta: Map<string, FebTeamMeta>
  statLines: FebStatLines
}

type FebAcc = {
  byPlayer: Map<string, FebPlayer>
  points: Map<string, PointLine>
  teamMeta: Map<string, FebTeamMeta>
  statLines: FebStatLines
}

/**
 * Scrape one regular-season group: select it via a postback, then pull every
 * team's roster, the full counting+shooting categories and the Equipo.aspx
 * bio/club/coach enrichment. Results accumulate into `acc`, so a player who
 * appears in more than one group (rare mid-season transfer between regional
 * groups) simply keeps their latest row — license ids are unique per person.
 */
async function collectGroup(
  url: string,
  cfg: FebConfig,
  baseHiddens: Hiddens,
  baseSelects: Select[],
  groupName: string,
  group: { value: string; text: string },
  acc: FebAcc,
): Promise<void> {
  // Selecting the group is itself a postback; everything afterwards must keep
  // the group pinned, so it rides along as an override on every request.
  const groupOverride: Record<string, string> = { [groupName]: group.value }
  await politePause()
  const regHtml = await fetchText(url, {
    method: "POST",
    body: buildPostBody(baseHiddens, baseSelects, groupName, groupOverride),
  })
  const hiddens = parseHiddens(regHtml)
  const selects = parseSelects(regHtml)

  for (const [id, line] of parsePointsRanking(regHtml)) acc.points.set(id, line)

  const teams = teamSelect(selects)
  const teamOptions = (teams?.options ?? []).filter((o) => isTeamOption(o.value))
  if (!teams || teamOptions.length === 0) {
    console.warn(`[feb:${cfg.id}] ${group.text}: no teams found`)
    return
  }
  const categorySelect = findSelect(selects, (s) =>
    s.options.some((o) => /rebotes totales/i.test(o.text)),
  )

  // Rosters (one postback per team).
  for (const opt of teamOptions) {
    try {
      await politePause()
      const html = await fetchText(url, {
        method: "POST",
        body: buildPostBody(hiddens, selects, teams.name, { ...groupOverride, [teams.name]: opt.value }),
      })
      for (const p of parseRoster(html, opt.value, opt.text)) acc.byPlayer.set(p.playerId, p)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[feb:${cfg.id}] ${group.text} team ${opt.value} failed: ${msg}`)
    }
  }

  // Full counting + shooting stats: one postback per (category, team). The
  // open ranking view only lists the top 30, but filtering by team returns
  // every player of that club for the chosen category.
  if (categorySelect) {
    for (const [key, catValue] of Object.entries(STAT_CATEGORIES) as Array<[StatCategoryKey, string]>) {
      let rows = 0
      for (const opt of teamOptions) {
        try {
          await politePause()
          const html = await fetchText(url, {
            method: "POST",
            body: buildPostBody(hiddens, selects, teams.name, {
              ...groupOverride,
              [teams.name]: opt.value,
              [categorySelect.name]: catValue,
            }),
          })
          for (const [playerId, line] of parseCategoryRows(html)) {
            let lines = acc.statLines.get(playerId)
            if (!lines) {
              lines = {}
              acc.statLines.set(playerId, lines)
            }
            lines[key] = line
            rows++
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn(`[feb:${cfg.id}] ${group.text} category ${key} team ${opt.value} failed: ${msg}`)
        }
      }
      console.log(`[feb:${cfg.id}] ${group.text} category ${key}: ${rows} rows`)
    }
  } else {
    console.warn(`[feb:${cfg.id}] ${group.text}: category select not found — stats limited to points`)
  }

  // Bio/club enrichment: one Equipo.aspx page per team covers its current
  // roster, the club logo/city and the head coach.
  let rosterHits = 0
  for (const opt of teamOptions) {
    try {
      await politePause()
      const html = await fetchText(`${BASE}/Equipo.aspx?i=${opt.value}`)
      acc.teamMeta.set(opt.value, parseTeamMeta(html))
      for (const [playerId, bio] of parseTeamRoster(html)) {
        const p = acc.byPlayer.get(playerId)
        if (p) {
          mergeBio(p, bio)
          rosterHits++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[feb:${cfg.id}] ${group.text} equipo ${opt.value} failed: ${msg}`)
    }
  }
  console.log(
    `[feb:${cfg.id}] ${group.text}: ${teamOptions.length} teams · roster bio matched ${rosterHits}`,
  )
}

async function collectData(cfg: FebConfig): Promise<FebData> {
  const url = `${BASE}/rankings.aspx?g=${cfg.g}&t=${SEASON_T}&nm=${cfg.nm}`
  const firstHtml = await fetchText(url)
  const baseHiddens = parseHiddens(firstHtml)
  const baseSelects = parseSelects(firstHtml)
  const acc: FebAcc = {
    byPlayer: new Map(),
    points: new Map(),
    teamMeta: new Map(),
    statLines: new Map(),
  }

  const groupSel = groupSelect(baseSelects)
  const groups = regularGroups(baseSelects)
  if (!groupSel || groups.length === 0) {
    console.warn(`[feb:${cfg.id}] no "Liga Regular" group found — nothing scraped`)
    return { players: [], points: acc.points, teamMeta: acc.teamMeta, statLines: acc.statLines }
  }
  console.log(
    `[feb:${cfg.id}] ${groups.length} regular-season group(s): ${groups.map((g) => g.text).join(" · ")}`,
  )
  for (const group of groups) {
    await collectGroup(url, cfg, baseHiddens, baseSelects, groupSel.name, group, acc)
  }

  // Ranked players already gone from their team's roster (transfers): fall
  // back to their own page. The i= param must be the team the license is
  // registered with, which is exactly the team their ranking row linked.
  const leftovers = [...acc.byPlayer.values()].filter((p) => !p.position && !p.nationality)
  for (const p of leftovers) {
    try {
      await politePause()
      const html = await fetchText(`${BASE}/Jugador.aspx?i=${p.teamId}&c=${p.playerId}`)
      mergeBio(p, parsePlayerPage(html))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[feb:${cfg.id}] jugador ${p.playerId} failed: ${msg}`)
    }
  }
  console.log(
    `[feb:${cfg.id}] collected ${acc.byPlayer.size} players · ${acc.teamMeta.size} teams · ` +
      `player-page fallbacks: ${leftovers.length}`,
  )
  return {
    players: [...acc.byPlayer.values()],
    points: acc.points,
    teamMeta: acc.teamMeta,
    statLines: acc.statLines,
  }
}

export function createFebAdapter(cfg: FebConfig): SourceAdapter {
  let cache: FebData | null = null
  const data = async () => (cache ??= await collectData(cfg))

  return {
    id: cfg.id,
    displayName: cfg.displayName,
    country: "ES",
    season: SEASON_YEAR,
    seasonCode: `${SEASON_YEAR}-${String(SEASON_YEAR + 1).slice(-2)}`,

    async fetchTeams(): Promise<SourceTeam[]> {
      const { players, teamMeta } = await data()
      const seen = new Map<string, SourceTeam>()
      for (const p of players) {
        if (p.teamId && p.teamName && !seen.has(p.teamId)) {
          const meta = teamMeta.get(p.teamId)
          seen.set(p.teamId, {
            sourceId: `feb-${p.teamId}`,
            name: p.teamName,
            country: "ES",
            city: meta?.city,
            logoUrl: meta?.logoUrl,
          })
        }
      }
      return [...seen.values()]
    },

    async fetchPlayers(): Promise<SourcePlayer[]> {
      return (await data()).players.map((p) => ({
        sourceId: `feb-${p.playerId}`, fullName: p.fullName, position: p.position,
        heightCm: p.heightCm, weightKg: p.weightKg, nationality: p.nationality,
        teamSourceId: p.teamId ? `feb-${p.teamId}` : undefined,
        // The c= license id in Jugador.aspx links doubles as the photo key.
        photoUrl: `https://imagenes.feb.es/Foto.aspx?c=${p.playerId}`,
      }))
    },

    async fetchStats(): Promise<ExtractedPlayerStat[]> {
      const { players, points, statLines } = await data()
      const out: ExtractedPlayerStat[] = []
      for (const p of players) {
        const games = p.games ?? points.get(p.playerId)?.games
        const ppg = p.ppg ?? points.get(p.playerId)?.ppg
        if (!games || games <= 0) continue
        const lines = statLines.get(p.playerId) ?? {}
        const total = (key: StatCategoryKey) => lines[key]?.total ?? null
        const two = lines.twoPoint
        const three = lines.threePoint
        const ft = lines.freeThrow
        const fgMade =
          two?.made != null || three?.made != null
            ? (two?.made ?? 0) + (three?.made ?? 0)
            : null
        const fgAttempted =
          two?.attempted != null || three?.attempted != null
            ? (two?.attempted ?? 0) + (three?.attempted ?? 0)
            : null
        out.push({
          playerSourceId: `feb-${p.playerId}`,
          season: SEASON_YEAR,
          teamSourceId: p.teamId ? `feb-${p.teamId}` : undefined,
          gamesPlayed: games,
          pointsTotal:
            p.pointsTotal ?? (ppg != null ? Math.round(ppg * games) : null),
          minutesTotal: total("minutes"),
          reboundsTotal: total("rebounds"),
          assistsTotal: total("assists"),
          stealsTotal: total("steals"),
          blocksTotal: total("blocks"),
          fgMade,
          fgAttempted,
          threeMade: three?.made ?? null,
          threeAttempted: three?.attempted ?? null,
          ftMade: ft?.made ?? null,
          ftAttempted: ft?.attempted ?? null,
          offensiveRebounds: total("offensiveRebounds"),
          defensiveRebounds: total("defensiveRebounds"),
          foulsTotal: total("fouls"),
          plusMinus: null, per: null, trueShootingPct: null,
          winShares: null, bpm: null,
        })
      }
      return out
    },

    async fetchCoaches(): Promise<SourceCoach[]> {
      const { teamMeta } = await data()
      const out: SourceCoach[] = []
      for (const [teamId, meta] of teamMeta) {
        if (!meta.coach?.fullName) continue
        out.push({
          sourceId: `feb-coach-${teamId}`,
          fullName: meta.coach.fullName,
          role: "head_coach",
          teamSourceId: `feb-${teamId}`,
          photoUrl: meta.coach.photoUrl,
          age: ageFromBirthdate(meta.coach.birthdate),
        })
      }
      return out
    },
    async fetchTeamStats(): Promise<SourceTeamStats[]> { return [] },
  }
}

export const FEB_CONFIGS: FebConfig[] = [
  { id: "leb-oro", displayName: "Primera FEB", g: 1, nm: "primerafeb" },
  { id: "leb-plata", displayName: "Segunda FEB", g: 2, nm: "segundafeb" },
  { id: "eba", displayName: "Tercera FEB", g: 3, nm: "tercerafeb" },
]

export const febAdapters = FEB_CONFIGS.map(createFebAdapter)
