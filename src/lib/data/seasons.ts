import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"
import { cached } from "@/lib/data/cache"
import { leagueSlugsFor } from "@/lib/league-groups"
import {
  CURRENT_SEASON_LABEL,
  canonicalSeasonLabel,
  compareSeasonsDesc,
  isSeasonLabel,
} from "@/lib/seasons"

/**
 * The season dimension every directory, profile and AI surface filters on.
 *
 * Two rules drive this file:
 *
 *  1. **The newest season wins by default.** Nothing in the app should have to
 *     know which season is "current" — it asks here and gets the newest one
 *     that actually has rows. That is deliberately not `seasons.is_current`:
 *     that flag is written by the sync and has been wrong before (every insert
 *     set it to true without demoting the previous season), so it is used as a
 *     tie-break, never as the source of truth.
 *  2. **Only seasons with data are offered.** A season row with no stats is a
 *     dead option in a dropdown, and the season a league has not synced yet
 *     would otherwise empty the page for everyone.
 */

export type SeasonOption = {
  /** Stored `seasons.name`, e.g. "2026-27". */
  name: string
  /** Human label — identical to `name` today, kept separate for future i18n. */
  label: string
  /** Whether the sync flagged this as the live season. */
  isCurrent: boolean
  /** Rows of player stats recorded for it (all leagues). */
  rows: number
}

type SeasonRow = { name: string; is_current: number | boolean; row_count: number | string }

/**
 * Every season that has at least one player-season row, newest first.
 *
 * Grouped by NAME, not by id: the DB carries duplicate season rows with the
 * same label from legacy syncs, and a dropdown must show "2025-26" once.
 */
async function listSeasonsUncached(leagueSlug?: string): Promise<SeasonOption[]> {
  const db = getDb()
  const leagueSlugs = leagueSlugsFor(leagueSlug)
  const leagueJoin = leagueSlugs
    ? sql`inner join leagues l on l.id = pss.league_id and l.slug in (${sql.join(
        leagueSlugs.map((s) => sql`${s}`),
        sql`, `,
      )})`
    : sql``

  try {
    const rows = await rawRows<SeasonRow>(
      db.execute(sql`
        select s.name as name,
               max(s.is_current) as is_current,
               count(*) as row_count
        from player_season_stats pss
        inner join seasons s on s.id = pss.season_id
        ${leagueJoin}
        group by s.name
      `),
    )

    const merged = new Map<string, SeasonOption>()
    for (const r of rows) {
      // Fold the legacy EuroLeague "E2025" label into "2025-26" so the switcher
      // never offers the same season twice under two names.
      const name = canonicalSeasonLabel(String(r.name))
      const prev = merged.get(name)
      const rowCount = Number(r.row_count ?? 0)
      const isCurrent = Boolean(Number(r.is_current ?? 0))
      if (prev) {
        prev.rows += rowCount
        prev.isCurrent = prev.isCurrent || isCurrent
      } else {
        merged.set(name, { name, label: name, isCurrent, rows: rowCount })
      }
    }

    return [...merged.values()].sort((a, b) => compareSeasonsDesc(a.name, b.name))
  } catch (error) {
    console.warn("[listSeasons] falling back to the configured season", error)
    return []
  }
}

export const listSeasons = cached(
  listSeasonsUncached,
  "seasons-list:v1",
  ["player-season-stats", "players"],
  1800,
)

/**
 * The season the site shows when the visitor has not chosen one.
 *
 * Newest season that holds data; the configured `CURRENT_SEASON_LABEL` is the
 * fallback for a cold or unreachable database so pages still render something
 * coherent instead of erroring.
 */
export async function latestSeasonName(leagueSlug?: string): Promise<string> {
  const all = await listSeasons(leagueSlug)
  return all[0]?.name ?? CURRENT_SEASON_LABEL
}

/**
 * Resolve a requested season to one we can actually serve.
 *
 * An unknown or malformed `?season=` never 404s the page — it silently falls
 * back to the newest season, which is what a visitor following a stale link
 * wants to see anyway.
 */
export async function resolveSeasonName(
  requested: string | null | undefined,
  leagueSlug?: string,
): Promise<string> {
  const all = await listSeasons(leagueSlug)
  if (requested && isSeasonLabel(requested)) {
    const wanted = canonicalSeasonLabel(requested)
    if (all.some((s) => s.name === wanted)) return wanted
  }
  return all[0]?.name ?? CURRENT_SEASON_LABEL
}

/**
 * Seasons a single player has rows for, newest first.
 *
 * Drives the season dropdown on a player profile, where offering a season the
 * player never played would render an empty card.
 */
export function playerSeasonOptions(names: string[]): string[] {
  const unique = new Set(names.map(canonicalSeasonLabel))
  return [...unique].sort(compareSeasonsDesc)
}
