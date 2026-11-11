/**
 * Men's and women's basketball are two separate worlds in this dataset.
 *
 * A league is one or the other, and everything hanging off a league (teams,
 * players, staff, stat rows) inherits that. Nothing is ever compared, matched,
 * traded or recommended across the boundary: a woman is measured against
 * women's leagues only, a man against men's leagues only.
 *
 * The league slug is the source of truth in code; `leagues.gender` mirrors it
 * in the database so SQL and exports can tell the two apart without this file.
 */

export type Gender = "men" | "women"

export const GENDERS: readonly Gender[] = ["men", "women"]

export const DEFAULT_GENDER: Gender = "men"

/**
 * Remembers which side the visitor is browsing so the choice follows them from
 * players to teams to staff. Readable by the client (not HttpOnly); a
 * `?gender=` in the URL always wins over it.
 */
export const GENDER_COOKIE = "ghs_gender"

export function isGender(value: unknown): value is Gender {
  return value === "men" || value === "women"
}

/**
 * Spanish women's pyramid, strongest first, all published by FEB. The fourth
 * level is covered through its national final phase only — see the
 * `primera-nacional-femenina` config in src/lib/sources/feb.ts.
 */
export const WOMEN_LEAGUE_SLUGS = [
  "lf-endesa",
  "lf-challenge",
  "lf2",
  "primera-nacional-femenina",
] as const

export const MEN_LEAGUE_SLUGS = [
  "nba",
  "euroleague",
  "acb",
  "leb-oro",
  "leb-plata",
  "eba",
] as const

const WOMEN_SET: ReadonlySet<string> = new Set(WOMEN_LEAGUE_SLUGS)

export function genderForLeagueSlug(slug: string | null | undefined): Gender {
  return slug && WOMEN_SET.has(slug) ? "women" : "men"
}

export function isWomenLeague(slug: string | null | undefined): boolean {
  return genderForLeagueSlug(slug) === "women"
}

export function leagueSlugsForGender(gender: Gender): string[] {
  return gender === "women" ? [...WOMEN_LEAGUE_SLUGS] : [...MEN_LEAGUE_SLUGS]
}

/** Query-string value → gender. Anything unrecognised is the default (men). */
export function parseGender(
  value: string | string[] | null | undefined,
): Gender {
  const v = Array.isArray(value) ? value[0] : value
  return v === "women" ? "women" : DEFAULT_GENDER
}

/** `gender` query-string value, or undefined for the default so URLs stay clean. */
export function genderParam(gender: Gender): string | undefined {
  return gender === DEFAULT_GENDER ? undefined : gender
}

/**
 * Women's clubs often carry the exact name of the men's section ("Valencia
 * Basket", "Casademont Zaragoza"). Teams are keyed by slug, so without a marker
 * the women's side would be written onto the men's row.
 */
export const WOMEN_TEAM_SLUG_SUFFIX = "-femenino"

export function teamSlugFor(baseSlug: string, gender: Gender): string {
  if (gender !== "women" || baseSlug.endsWith(WOMEN_TEAM_SLUG_SUFFIX)) {
    return baseSlug
  }
  return `${baseSlug}${WOMEN_TEAM_SLUG_SUFFIX}`
}
