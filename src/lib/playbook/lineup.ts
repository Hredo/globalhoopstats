/**
 * The real production of the players linked to a play's tokens: their newest
 * season with a real sample, per game, plus the five's combined scoring. What a
 * coach wants next to a set: who is running it and what they actually do.
 */
import { getPlayerLines } from "@/lib/scouting/profile"
import { baseLine } from "@/lib/scouting/projection"
import { metricValues, minutesPerGame, trueShooting } from "@/lib/scouting/metrics"

export type LineupMember = {
  slug: string
  name: string
  position: string | null
  league: string
  team: string | null
  season: string
  mpg: number | null
  pts: number | null
  reb: number | null
  ast: number | null
  ts: number | null
}

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)

export async function lineupStats(slugs: string[]): Promise<{ members: LineupMember[]; totals: { pts: number; reb: number; ast: number } }> {
  const members: LineupMember[] = []
  for (const slug of [...new Set(slugs)].slice(0, 10)) {
    const p = await getPlayerLines(slug)
    if (!p) continue
    const base = baseLine(p.lines)
    if (!base) continue
    const pg = metricValues(base.line, "perGame")
    members.push({
      slug: p.slug,
      name: p.fullName,
      position: p.position,
      league: base.leagueName,
      team: base.teamName,
      season: base.season,
      mpg: r1(minutesPerGame(base.line)),
      pts: r1(pg.pts),
      reb: r1(pg.reb),
      ast: r1(pg.ast),
      ts: trueShooting(base.line),
    })
  }
  const sum = (k: "pts" | "reb" | "ast") => r1(members.reduce((a, m) => a + (m[k] ?? 0), 0)) ?? 0
  return { members, totals: { pts: sum("pts"), reb: sum("reb"), ast: sum("ast") } }
}
