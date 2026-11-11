import { CURRENT_SEASON_START_YEAR, seasonLabel } from "@/lib/seasons"
import type { SourceShotZones } from "@/lib/sources/shot-zones"

export type SourceId =
  | "nba"
  | "acb"
  | "euroleague"
  | "leb-oro"
  | "leb-plata"
  | "eba"
  | "lf-endesa"
  | "lf-challenge"
  | "lf2"
  | "primera-nacional-femenina"

/**
 * Season every adapter scrapes, as a start year.
 *
 * Derived from the single knob in `@/lib/seasons` so opening a new campaign is
 * one edit, not seven. Kept exported under its old name because backfill
 * scripts import it.
 */
export const CURRENT_SEASON = CURRENT_SEASON_START_YEAR

/** Label written to `seasons.name` — shared by every league. */
export const CURRENT_SEASON_CODE = seasonLabel(CURRENT_SEASON)

/**
 * Newest edition of a competition that is only played as a June final phase
 * (start year). The edition of season Y is published in June of Y+1, so from
 * the season's opening until then the latest one that exists is Y-1's. Never
 * ahead of the configured season.
 */
export function finalPhaseSeason(now: Date = new Date()): number {
  const year = now.getFullYear()
  const played = now.getMonth() + 1 >= 6 ? year - 1 : year - 2
  return Math.min(played, CURRENT_SEASON)
}

const FINAL_PHASE_SEASON = finalPhaseSeason()

/**
 * Per-source identity.
 *
 * `seasonLabel` is what lands in the database and what a visitor sees; every
 * league shares it. `seasonCode` is what the upstream feed calls the same
 * season and differs per source — the EuroLeague API keys on "E2026", the NBA
 * stats API on "2026-27", the FEB rankings postback on the bare start year.
 * Only the adapter talking to that feed should ever read `seasonCode`.
 */
export const SOURCE_META: Record<
  SourceId,
  {
    displayName: string
    country: string
    /** Upstream feed identifier for the season. */
    seasonCode: string
    /** Canonical, cross-league season label stored in `seasons.name`. */
    seasonLabel: string
    /** Season start year. */
    season: number
  }
> = {
  nba: {
    displayName: "NBA",
    country: "USA",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  euroleague: {
    displayName: "EuroLeague",
    country: "EU",
    // The feeds API keys seasons as E<start year>.
    seasonCode: `E${CURRENT_SEASON}`,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  acb: {
    displayName: "Liga Endesa",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  "leb-oro": {
    displayName: "Primera FEB",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  "leb-plata": {
    displayName: "Segunda FEB",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  eba: {
    displayName: "Tercera FEB",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  // Women's pyramid (see src/lib/gender.ts). Same FEB feed as the men's
  // feeder divisions, a different competition id.
  "lf-endesa": {
    displayName: "Liga Femenina Endesa",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  "lf-challenge": {
    displayName: "Liga Femenina Challenge",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  lf2: {
    displayName: "Liga Femenina 2",
    country: "ES",
    seasonCode: CURRENT_SEASON_CODE,
    seasonLabel: CURRENT_SEASON_CODE,
    season: CURRENT_SEASON,
  },
  // Only its national final phase exists as one feed, and that is played in
  // June: until then the newest edition is last season's.
  "primera-nacional-femenina": {
    displayName: "Primera Nacional Femenina",
    country: "ES",
    seasonCode: seasonLabel(FINAL_PHASE_SEASON),
    seasonLabel: seasonLabel(FINAL_PHASE_SEASON),
    season: FINAL_PHASE_SEASON,
  },
}

/**
 * Who publishes each league's numbers before we normalise them — named on the
 * public pages, in llms.txt and in the Dataset JSON-LD so a citation can credit
 * the original publisher as well as this site. Keep in step with DATA-SOURCES.md.
 */
export const SOURCE_UPSTREAM: Record<SourceId, { name: string; url: string }> =
  {
    nba: {
      name: "NBA.com / Basketball-Reference",
      url: "https://www.nba.com/stats",
    },
    euroleague: {
      name: "EuroLeague Basketball",
      url: "https://www.euroleaguebasketball.net/euroleague/",
    },
    acb: { name: "ACB.com", url: "https://www.acb.com" },
    "leb-oro": { name: "FEB", url: "https://baloncestoenvivo.feb.es" },
    "leb-plata": { name: "FEB", url: "https://baloncestoenvivo.feb.es" },
    eba: { name: "FEB", url: "https://baloncestoenvivo.feb.es" },
    "lf-endesa": { name: "FEB", url: "https://baloncestoenvivo.feb.es" },
    "lf-challenge": { name: "FEB", url: "https://baloncestoenvivo.feb.es" },
    lf2: { name: "FEB", url: "https://baloncestoenvivo.feb.es" },
    "primera-nacional-femenina": {
      name: "FEB",
      url: "https://baloncestoenvivo.feb.es",
    },
  }

export function upstreamFor(
  slug: string,
): { name: string; url: string } | null {
  return slug in SOURCE_UPSTREAM ? SOURCE_UPSTREAM[slug as SourceId] : null
}

/**
 * Resolve the canonical display name for a league by its slug.
 * Falls back to the DB-stored name when the slug is unknown so that
 * data-layer queries always show the correct name regardless of what
 * the `leagues` table currently holds from past syncs.
 */
export function resolveLeagueName(slug: string, fallback: string): string {
  if (slug in SOURCE_META) {
    return SOURCE_META[slug as SourceId].displayName
  }
  return fallback
}

export type SourceTeam = {
  sourceId: string
  name: string
  shortName?: string
  country?: string
  city?: string
  logoUrl?: string
  foundedYear?: number
  arena?: string
  arenaCapacity?: number
  websiteUrl?: string
  primaryColor?: string
  secondaryColor?: string
}

export type SourcePlayer = {
  sourceId: string
  fullName: string
  birthdate?: string
  nationality?: string
  position?: string
  jerseyNumber?: string
  age?: number
  heightCm?: number
  weightKg?: number
  teamSourceId?: string
  photoUrl?: string
  licenseType?: string
}

export type SourceCoach = {
  sourceId: string
  fullName: string
  role: "head_coach" | "assistant_coach" | "staff"
  teamSourceId?: string
  nationality?: string
  age?: number
  photoUrl?: string
  licenseType?: string
}

export type SourceTeamStats = {
  teamSourceId: string
  season: number
  gamesPlayed: number
  wins: number
  losses: number
  winPct?: number
  pointsFor?: number
  pointsAgainst?: number
  position?: number
  pace?: number
  offRtg?: number
  defRtg?: number
  netRtg?: number
  sos?: number
}

export type ExtractedPlayerStat = {
  playerSourceId: string
  teamSourceId?: string
  season: number
  gamesPlayed: number
  minutesTotal: number | null
  pointsTotal: number | null
  reboundsTotal: number | null
  assistsTotal: number | null
  stealsTotal: number | null
  blocksTotal: number | null
  fgMade: number | null
  fgAttempted: number | null
  threeMade: number | null
  threeAttempted: number | null
  ftMade: number | null
  ftAttempted: number | null
  offensiveRebounds: number | null
  defensiveRebounds: number | null
  foulsTotal: number | null
  plusMinus: number | null
  per: number | null
  trueShootingPct: number | null
  winShares: number | null
  bpm: number | null
}

export type SourceAdapter = {
  id: SourceId
  displayName: string
  country: string
  season: number
  /** Upstream feed identifier — never written to the database. */
  seasonCode: string
  /** Canonical season label stored in `seasons.name`. */
  seasonLabel: string
  fetchTeams(): Promise<SourceTeam[]>
  fetchPlayers(): Promise<SourcePlayer[]>
  fetchStats(): Promise<ExtractedPlayerStat[]>
  fetchCoaches(): Promise<SourceCoach[]>
  fetchTeamStats(): Promise<SourceTeamStats[]>
  /** Per-zone shooting, only where the league publishes shot locations. */
  fetchShotZones?(): Promise<SourceShotZones[]>
  fetchTeamDetails?(
    teamIds: string[],
  ): Promise<Map<string, Partial<SourceTeam> & Record<string, unknown>>>
}
