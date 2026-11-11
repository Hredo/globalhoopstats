import { isWomenLeague } from "@/lib/gender"

/**
 * League "tier" classification used for identity resolution.
 *
 * Domain invariant (owner): the Spanish FEB feeder divisions (Primera FEB,
 * Segunda FEB, Tercera FEB) are MUTUALLY EXCLUSIVE with the top tier
 * (ACB / EuroLeague / NBA) for a single person in this dataset. Spain has
 * many people who share a first name + first surname, and the FEB rosters are
 * full of amateurs/youth namesakes of professional players. So a record
 * carrying BOTH a FEB and a top-tier stat row is, in practice, two different
 * people that loose name-only matching collapsed into one. We therefore never
 * merge across this boundary.
 *
 * This is deliberately conservative: it can leave a genuine LEB→ACB promotion
 * as two records (a recoverable, cheap mistake) but it never fuses a star with
 * a random amateur namesake (an expensive, user-visible mistake).
 */

export const FEB_LEAGUE_SLUGS = new Set(["leb-oro", "leb-plata", "eba"])

/** Display names the FEB adapters use (matcher sees league display names). */
export const FEB_LEAGUE_NAMES = new Set([
  "leb oro",
  "leb plata",
  "liga eba",
  "primera feb",
  "segunda feb",
  "tercera feb",
])

/** Display names of the women's competitions (all published by FEB). */
export const WOMEN_LEAGUE_NAMES = new Set([
  "liga femenina endesa",
  "liga femenina challenge",
  "liga femenina 2",
  "primera nacional femenina",
])

/**
 * "women" is its own tier: the three women's leagues share FEB licence ids and
 * players move between them every summer, so they merge freely with each other
 * — and never with a men's record, whatever the name says.
 */
export type LeagueTier = "feb" | "top" | "women"

/** Tier for a league SLUG (e.g. "eba" -> "feb", "acb" -> "top"). */
export function tierForSlug(slug: string): LeagueTier {
  if (isWomenLeague(slug)) return "women"
  return FEB_LEAGUE_SLUGS.has(slug) ? "feb" : "top"
}

/** Tier for a league DISPLAY NAME (e.g. "Tercera FEB" -> "feb"). */
export function tierForName(name: string): LeagueTier {
  const key = name.trim().toLowerCase()
  if (WOMEN_LEAGUE_NAMES.has(key)) return "women"
  return FEB_LEAGUE_NAMES.has(key) ? "feb" : "top"
}

/**
 * True when two tier sets must NOT be merged onto one person: one side touches
 * FEB and the other touches the top tier. Same-tier combos (ACB+EuroLeague, or
 * EBA+LEB) are allowed — a real player can climb within FEB or play ACB+EL.
 */
export function tiersConflict(
  a: Iterable<LeagueTier>,
  b: Iterable<LeagueTier>,
): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  const febVsTop = (x: Set<LeagueTier>, y: Set<LeagueTier>) =>
    x.has("feb") && y.has("top")
  // A women's record never absorbs a men's one, nor the other way round.
  const womenVsMen = (x: Set<LeagueTier>, y: Set<LeagueTier>) =>
    x.has("women") && (y.has("feb") || y.has("top"))
  return (
    febVsTop(sa, sb) ||
    febVsTop(sb, sa) ||
    womenVsMen(sa, sb) ||
    womenVsMen(sb, sa)
  )
}
