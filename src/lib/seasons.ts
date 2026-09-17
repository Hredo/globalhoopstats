/**
 * Season identity, in one place.
 *
 * A season has two names and they are NOT the same thing:
 *
 *  - the **label** ("2026-27") is what the DB stores in `seasons.name`, what
 *    the UI shows and what every league shares. NBA, ACB, EuroLeague and the
 *    three FEB competitions all play the 2026-27 season, so they must all land
 *    on the same `seasons` row or a season filter can never be global.
 *  - the **feed code** ("2026-27" for the NBA API, "E2026" for the EuroLeague
 *    feed, "2026" for the FEB rankings postback) is whatever the upstream
 *    source calls it, and only the adapter that talks to that source cares.
 *
 * Conflating the two is what produced the split "E2025" vs "2025-26" rows in
 * the DB: the orchestrator used the feed code as the season name, so EuroLeague
 * stats ended up under a season nothing else shared. Adapters now carry both
 * (`seasonLabel` + `seasonCode`) and only the label ever reaches the database.
 */

/**
 * Start year of the season the site treats as current.
 *
 * This is the ONE number to bump when a new season opens. Everything else —
 * the label, each source's feed code, the Basketball-Reference year — derives
 * from it.
 */
export const CURRENT_SEASON_START_YEAR = 2026

/** `2026` → `"2026-27"`. */
export function seasonLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
}

/** The label of the season the site treats as current ("2026-27"). */
export const CURRENT_SEASON_LABEL = seasonLabel(CURRENT_SEASON_START_YEAR)

/**
 * Start year of a stored season name, or null when it is not a season label.
 *
 * Accepts the canonical `2026-27` and the legacy EuroLeague `E2026` that older
 * syncs wrote, so ordering keeps working on a database that has not been
 * migrated yet.
 */
export function seasonStartYear(name: string | null | undefined): number | null {
  if (!name) return null
  const trimmed = name.trim()
  const dashed = trimmed.match(/^(\d{4})-(\d{2})$/)
  if (dashed) return Number(dashed[1])
  const euro = trimmed.match(/^E(\d{4})$/i)
  if (euro) return Number(euro[1])
  const bare = trimmed.match(/^(\d{4})$/)
  if (bare) return Number(bare[1])
  return null
}

/** Canonical label for a stored season name (`E2025` → `2025-26`). */
export function canonicalSeasonLabel(name: string): string {
  const start = seasonStartYear(name)
  return start == null ? name.trim() : seasonLabel(start)
}

/** True when `name` is a season label this app recognises. */
export function isSeasonLabel(name: string | null | undefined): boolean {
  return seasonStartYear(name) != null
}

/**
 * Newest-first comparator for season names.
 *
 * Sorting on the raw string would be enough for `2025-26` vs `2026-27`, but not
 * for a database that still holds `E2025`, which sorts after every numeric
 * label. Comparing parsed start years keeps legacy rows in their real place.
 */
export function compareSeasonsDesc(a: string, b: string): number {
  const ya = seasonStartYear(a)
  const yb = seasonStartYear(b)
  if (ya != null && yb != null && ya !== yb) return yb - ya
  if (ya != null && yb == null) return -1
  if (ya == null && yb != null) return 1
  return b.localeCompare(a)
}

/**
 * Every stored `seasons.name` that means this season.
 *
 * A query filtering on "2026-27" must also match the legacy `E2026` rows an
 * un-migrated EuroLeague sync wrote, otherwise switching to a season silently
 * drops one whole league. Once `scripts/rollover-season.ts` has merged the
 * E-prefixed rows this returns a single name, and the extra `IN (…)` element
 * costs nothing.
 */
export function seasonNameVariants(label: string): string[] {
  const start = seasonStartYear(label)
  if (start == null) return [label]
  return [seasonLabel(start), `E${start}`]
}

/** The season immediately before `name`, or null when it cannot be derived. */
export function previousSeasonLabel(name: string): string | null {
  const start = seasonStartYear(name)
  return start == null ? null : seasonLabel(start - 1)
}

/**
 * Season sentinel meaning "do not filter by season at all".
 *
 * Only career-wide lookups (a player's own profile, the sitemap, an archive
 * search) want this; every browsable surface pins one season so its rows are
 * comparable with each other.
 */
export const ALL_SEASONS = "all"

/**
 * Validate a `?season=` query parameter.
 *
 * Returns undefined for anything that is not a season label, so an unknown or
 * hand-edited value falls through to the newest season rather than filtering
 * the page down to nothing.
 */
export function parseSeasonParam(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (trimmed === ALL_SEASONS) return ALL_SEASONS
  return isSeasonLabel(trimmed) ? canonicalSeasonLabel(trimmed) : undefined
}

/**
 * Below this many games a season is "too thin to judge on its own" — the AI
 * surfaces must reach back to previous seasons to say anything useful.
 *
 * Five games is roughly the point where per-game averages stop swinging wildly
 * on a single blow-out, and it matches the `minGames` floor the market pool
 * already uses to keep cameos out of valuations.
 */
export const THIN_SEASON_GAMES = 5
