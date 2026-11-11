/**
 * The projection as the pages need it: pick the line to project from, the
 * league to project into, and say which method produced the factors.
 */
import { getFactors, getPlayerLines, type PlayerLine } from "@/lib/scouting/profile"
import { actual, project, type Factors, type Projection } from "@/lib/scouting/projection-model"
import { minutesPerGame } from "@/lib/scouting/metrics"
import { tierForSlug } from "@/lib/leagues-tier"
import { resolveLeagueName } from "@/lib/sources/types"
import { genderForLeagueSlug, isWomenLeague } from "@/lib/gender"

/** The next step up the ladder, as players actually move. */
export const NEXT_LEVEL: Record<string, string | undefined> = {
  eba: "leb-plata",
  "leb-plata": "leb-oro",
  "leb-oro": "acb",
  acb: "euroleague",
  euroleague: "nba",
  // The women's ladder is its own: it never leads into a men's league.
  "primera-nacional-femenina": "lf2",
  lf2: "lf-challenge",
  "lf-challenge": "lf-endesa",
}

export const PROJECTABLE_LEAGUES = [
  "nba",
  "euroleague",
  "acb",
  "leb-oro",
  "leb-plata",
  "eba",
  "lf-endesa",
  "lf-challenge",
  "lf2",
  "primera-nacional-femenina",
] as const

/** Where a player at the top of their ladder is projected by default. */
function defaultTarget(fromSlug: string): string {
  if (NEXT_LEVEL[fromSlug]) return NEXT_LEVEL[fromSlug]
  if (fromSlug === "nba") return "euroleague"
  if (fromSlug === "lf-endesa") return "lf-challenge"
  return isWomenLeague(fromSlug) ? "lf-endesa" : "acb"
}

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
  // A target on the other side is ignored: a woman is projected into women's
  // leagues only, a man into men's.
  const toSlug =
    target &&
    (PROJECTABLE_LEAGUES as readonly string[]).includes(target) &&
    target !== base.leagueSlug &&
    genderForLeagueSlug(target) === genderForLeagueSlug(base.leagueSlug)
      ? target
      : defaultTarget(base.leagueSlug)
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
