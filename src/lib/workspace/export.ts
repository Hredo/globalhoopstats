/**
 * Spreadsheet exports. One row per player-league-season with the counting
 * stats per game, the shooting splits and the league-neutral rates (per 40,
 * pace-adjusted per 40, true shooting) the rest of the app ranks on.
 */
import { csvRow, UTF8_BOM } from "@/lib/security/csv"
import { getLeagueField, type FieldRow } from "@/lib/scouting/profile"
import { metricValues, minutesPerGame, paceFactor, trueShooting } from "@/lib/scouting/metrics"

export type ExportOptions = { separator: "," | ";" }

const HEADER = [
  "player", "slug", "team", "league", "season", "gp", "mpg",
  "pts", "reb", "ast", "stl", "blk",
  "fg_pct", "three_pct", "ft_pct", "ts_pct", "per",
  "pts_per40", "reb_per40", "ast_per40", "pts_per40_pace",
] as const

const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10)
const r3 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 1000) / 1000)
const pct = (m: number | null, a: number | null) => (m == null || a == null || a <= 0 ? null : m / a)

/**
 * Numbers are written with a decimal comma when the separator is `;`, which is
 * what a Spanish Excel parses as a number rather than text.
 */
function num(v: number | null, sep: "," | ";"): string | null {
  if (v == null) return null
  return sep === ";" ? String(v).replace(".", ",") : String(v)
}

export function fieldToCsv(
  rows: Array<{ league: string; season: string; field: FieldRow[] }>,
  opts: ExportOptions,
): string {
  const sep = opts.separator
  let out = UTF8_BOM + csvRow([...HEADER], sep)
  for (const { league, season, field } of rows) {
    const paces = field.map((f) => f.teamPace).filter((p): p is number => p != null && p > 0)
    const leaguePace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null
    for (const f of field) {
      const l = f.line
      const g = l.gamesPlayed
      const pg = metricValues(l, "perGame")
      const p40 = metricValues(l, "per40")
      const pace = metricValues(l, "per40pace", paceFactor(f.teamPace, leaguePace))
      out += csvRow(
        [
          f.fullName, f.slug, f.teamName, league, season, g,
          num(r1(minutesPerGame(l)), sep),
          num(r1(pg.pts), sep), num(r1(pg.reb), sep), num(r1(pg.ast), sep),
          num(r1(pg.stl), sep), num(r1(pg.blk), sep),
          num(r3(pct(l.fgMade, l.fgAttempted)), sep),
          num(r3(pct(l.threeMade, l.threeAttempted)), sep),
          num(r3(pct(l.ftMade, l.ftAttempted)), sep),
          num(r3(trueShooting(l)), sep),
          num(r1(l.per), sep),
          num(r1(p40.pts), sep), num(r1(p40.reb), sep), num(r1(p40.ast), sep),
          num(r1(pace.pts), sep),
        ],
        sep,
      )
    }
  }
  return out
}

export async function exportLeagueSeason(
  leagueSlugs: string[],
  season: string,
  opts: ExportOptions,
): Promise<string> {
  const rows = []
  for (const slug of leagueSlugs) {
    rows.push({ league: slug, season, field: await getLeagueField(slug, season) })
  }
  return fieldToCsv(rows, opts)
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
