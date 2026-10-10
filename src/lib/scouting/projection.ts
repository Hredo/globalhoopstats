/**
 * The projection as the pages need it: pick the line to project from, the
 * league to project into, and say which method produced the factors.
 */
import { getFactors, getPlayerLines, type PlayerLine } from "@/lib/scouting/profile"
import { actual, project, type Factors, type Projection } from "@/lib/scouting/projection-model"
import { minutesPerGame } from "@/lib/scouting/metrics"
import { tierForSlug } from "@/lib/leagues-tier"
import { resolveLeagueName } from "@/lib/sources/types"

/** The next step up the ladder, as players actually move. */
export const NEXT_LEVEL: Record<string, string | undefined> = {
  eba: "leb-plata",
  "leb-plata": "leb-oro",
  "leb-oro": "acb",
  acb: "euroleague",
  euroleague: "nba",
}

export const PROJECTABLE_LEAGUES = ["nba", "euroleague", "acb", "leb-oro", "leb-plata", "eba"] as const

/** Most recent line with a real sample (≥ 8 games, ≥ 8 minutes a game). */
export function baseLine(lines: PlayerLine[]): PlayerLine | null {
  return (
    lines.find((l) => l.line.gamesPlayed >= 8 && (minutesPerGame(l.line) ?? 0) >= 8) ??
    lines.find((l) => l.line.gamesPlayed >= 3 && (minutesPerGame(l.line) ?? 0) > 0) ??
    null
  )
}

export type ProjectionResult = {
  player: { slug: string; fullName: string; position: string | null; imageUrl: string | null }
  from: { league: string; leagueName: string; season: string; team: string | null }
  to: { league: string; leagueName: string }
  actual: Projection
  projected: Projection
  factors: Factors
  /** FEB ↔ top tier: by construction no shared records, always the model. */
  crossesTier: boolean
}

export async function projectPlayer(
  slug: string,
  target?: string | null,
): Promise<ProjectionResult | { error: "not_found" | "no_line" }> {
  const p = await getPlayerLines(slug)
  if (!p) return { error: "not_found" }
  const base = baseLine(p.lines)
  if (!base) return { error: "no_line" }
  const toSlug =
    target && (PROJECTABLE_LEAGUES as readonly string[]).includes(target) && target !== base.leagueSlug
      ? target
      : (NEXT_LEVEL[base.leagueSlug] ?? (base.leagueSlug === "nba" ? "euroleague" : "acb"))
  const factors = await getFactors(base.leagueSlug, toSlug)
  return {
    player: { slug: p.slug, fullName: p.fullName, position: p.position, imageUrl: p.imageUrl },
    from: { league: base.leagueSlug, leagueName: base.leagueName, season: base.season, team: base.teamName },
    to: { league: toSlug, leagueName: resolveLeagueName(toSlug, toSlug) },
    actual: actual(base.line),
    projected: project(base.line, factors),
    factors,
    crossesTier: tierForSlug(base.leagueSlug) !== tierForSlug(toSlug),
  }
}
