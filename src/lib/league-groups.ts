/**
 * League filter grouping shared by the navbar dropdowns and the in-page
 * directory filters. The three Spanish FEB competitions are grouped under a
 * single "FEB" parent: selecting `feb` matches all three, while each child
 * (leb-oro / leb-plata / eba) matches only itself.
 */

import {
  genderForLeagueSlug,
  leagueSlugsForGender,
  type Gender,
} from "@/lib/gender"

export const FEB_GROUP_SLUG = "feb"
export const FEB_LEAGUE_SLUGS = ["leb-oro", "leb-plata", "eba"] as const

export type LeagueFilterChild = { slug: string; label: string }
export type LeagueFilterNode = LeagueFilterChild & {
  children?: LeagueFilterChild[]
}

export const LEAGUE_FILTER_TREE: LeagueFilterNode[] = [
  { slug: "nba", label: "NBA" },
  { slug: "euroleague", label: "EuroLeague" },
  { slug: "acb", label: "ACB" },
  {
    slug: FEB_GROUP_SLUG,
    label: "FEB",
    children: [
      { slug: "leb-oro", label: "Primera FEB" },
      { slug: "leb-plata", label: "Segunda FEB" },
      { slug: "eba", label: "Tercera FEB" },
    ],
  },
]

/** Women's side: three FEB competitions, shown flat (no parent group). */
export const WOMEN_LEAGUE_FILTER_TREE: LeagueFilterNode[] = [
  { slug: "lf-endesa", label: "LF Endesa" },
  { slug: "lf-challenge", label: "LF Challenge" },
  { slug: "lf2", label: "LF 2" },
  { slug: "primera-nacional-femenina", label: "1ª Nacional Fem." },
]

export function leagueFilterTree(gender: Gender): LeagueFilterNode[] {
  return gender === "women" ? WOMEN_LEAGUE_FILTER_TREE : LEAGUE_FILTER_TREE
}

const FEB_CHILD_SET: ReadonlySet<string> = new Set(FEB_LEAGUE_SLUGS)

/** True when a selected filter slug belongs to the FEB group (parent or child). */
export function isFebFilter(slug: string | null | undefined): boolean {
  return slug === FEB_GROUP_SLUG || (!!slug && FEB_CHILD_SET.has(slug))
}

/**
 * Pseudo-slugs for "every league of this gender". `men` is what an empty
 * filter means; `women` is what the gender switch sends when no single league
 * is picked. `all` is the explicit escape hatch for the few callers (exports,
 * maintenance) that really want both.
 */
export const MEN_GROUP_SLUG = "men"
export const WOMEN_GROUP_SLUG = "women"
export const ALL_LEAGUES_SLUG = "all"

/** Every value a `?league=` filter may carry; anything else is ignored. */
export const LEAGUE_FILTER_VALUES: ReadonlySet<string> = new Set([
  ...leagueSlugsForGender("men"),
  ...leagueSlugsForGender("women"),
  FEB_GROUP_SLUG,
  MEN_GROUP_SLUG,
  WOMEN_GROUP_SLUG,
])

/**
 * Expand a filter slug to the concrete league slugs it matches.
 *
 * No filter means the MEN's leagues, not "everything": the two genders never
 * share a listing, and men's is the default view. A caller that forgets about
 * gender therefore keeps showing exactly what it showed before the women's
 * leagues existed instead of silently mixing them in. Returns null only for
 * the explicit `all`.
 */
export function leagueSlugsFor(
  slug: string | null | undefined,
): string[] | null {
  if (slug === ALL_LEAGUES_SLUG) return null
  if (!slug || slug === MEN_GROUP_SLUG) return leagueSlugsForGender("men")
  if (slug === WOMEN_GROUP_SLUG) return leagueSlugsForGender("women")
  if (slug === FEB_GROUP_SLUG) return [...FEB_LEAGUE_SLUGS]
  return [slug]
}

/** Gender a filter slug belongs to ("feb" is the men's feeder group). */
export function genderForFilter(slug: string | null | undefined): Gender {
  return slug === WOMEN_GROUP_SLUG ? "women" : genderForLeagueSlug(slug)
}

/**
 * The league filter a query should run with: the picked league, or the whole
 * gender when none is picked. A league from the other side wins over `gender`
 * — it already says which side is meant.
 */
export function scopeLeague(
  league: string | null | undefined,
  gender: Gender,
): string {
  if (league) return league
  return gender === "women" ? WOMEN_GROUP_SLUG : MEN_GROUP_SLUG
}
