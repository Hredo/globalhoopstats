/**
 * Squad reconciliation shared by both sync paths.
 *
 * A season's roster is the set of (player, team) pairs the source publishes for
 * it. Anything stored for that league+season that is NOT in the scrape is a
 * departure: the player left the club, so they must stop appearing on it — for
 * that season only. Previous seasons are history and are never touched, which
 * is what lets a profile still show "2025-26 · Real Madrid" after a transfer.
 *
 * The thresholds below exist because this deletes rows. The quality gate asks
 * "is this batch plausible enough to write?"; pruning needs a stronger answer,
 * because a half-rendered page that yields six players would otherwise wipe a
 * genuine roster. Below the floor we keep stale members instead — a visible,
 * self-correcting error rather than data loss.
 */

/** Minimum player-team pairs a scrape must yield before departures are pruned. */
export const MIN_PAIRS_TO_PRUNE = 40

/** Same floor for coaching staff, which is an order of magnitude smaller. */
export const MIN_COACHES_TO_PRUNE = 8

/**
 * Ids stored for a season that the fresh scrape no longer contains.
 *
 * Pure so the rule can be unit-tested without a database.
 */
export function findDepartedIds<T extends { id: string }>(
  stored: T[],
  keyOf: (row: T) => string,
  currentKeys: ReadonlySet<string>,
): string[] {
  return stored.filter((row) => !currentKeys.has(keyOf(row))).map((r) => r.id)
}

/**
 * Split ids into DELETE-sized batches.
 *
 * A league-wide turnover can be several hundred ids and one `IN (…)` list that
 * long risks the placeholder limit, so deletes are chunked.
 */
export function chunkIds(ids: string[], size = 200): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

/**
 * Whether a scrape is solid enough to delete departures from.
 *
 * Returns the reason to skip when it is not, so callers log something a human
 * can act on instead of silently doing nothing.
 */
export function pruneVerdict(
  pairCount: number,
  floor: number,
): { prune: true } | { prune: false; reason: string } {
  if (pairCount >= floor) return { prune: true }
  return {
    prune: false,
    reason:
      `only ${pairCount} pairs scraped (< ${floor}) — refusing to prune a ` +
      `possibly partial scrape`,
  }
}
