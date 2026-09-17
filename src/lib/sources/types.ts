import { CURRENT_SEASON_START_YEAR, seasonLabel } from "@/lib/seasons"

export type SourceId =
  | "nba"
  | "acb"
  | "euroleague"
  | "leb-oro"
  | "leb-plata"
  | "eba"

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
  fetchTeamDetails?(
    teamIds: string[],
  ): Promise<Map<string, Partial<SourceTeam> & Record<string, unknown>>>
}
