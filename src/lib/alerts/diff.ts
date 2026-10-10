/**
 * What changed between two snapshots of something a user follows. Pure: the
 * engine feeds it the stored snapshot and a fresh one and turns the events into
 * notifications.
 *
 * Quiet by design. A first snapshot never fires (following someone is not
 * news), a threshold fires once when it is CROSSED rather than every night it
 * stays above, and a team's season rollover is one event instead of fifteen
 * "new player" alerts.
 */
import type { FollowSnapshot, FollowThresholds } from "@/lib/db/schema"

export type PlayerSnapshot = Extract<FollowSnapshot, { kind: "player" }>
export type TeamSnapshot = Extract<FollowSnapshot, { kind: "team" }>

export type AlertEvent =
  | { type: "team_change"; fromTeam: string | null; toTeam: string | null }
  | { type: "threshold"; metric: keyof FollowThresholds; value: number; threshold: number }
  | { type: "roster_in"; playerIds: string[] }
  | { type: "roster_out"; playerIds: string[] }
  | { type: "coach_change"; from: string | null; to: string | null }
  | { type: "new_season"; season: string }

/** Games before a per-game average is worth alerting on. */
export const MIN_GAMES_FOR_THRESHOLD = 3

export function diffPlayer(
  prev: PlayerSnapshot | null,
  next: PlayerSnapshot,
  thresholds: FollowThresholds | null,
): AlertEvent[] {
  if (!prev) return []
  const events: AlertEvent[] = []

  if (next.teamId && prev.teamId && next.teamId !== prev.teamId) {
    events.push({ type: "team_change", fromTeam: prev.teamName, toTeam: next.teamName })
  }

  if (thresholds && next.gamesPlayed >= MIN_GAMES_FOR_THRESHOLD) {
    // A new season starts every average from scratch, so "crossed" compares
    // against the previous value only within the same season.
    const sameSeason = prev.season === next.season
    for (const [metric, threshold] of Object.entries(thresholds) as Array<
      [keyof FollowThresholds, number | undefined]
    >) {
      if (threshold == null || !Number.isFinite(threshold)) continue
      const now = next[metric]
      if (now == null || now < threshold) continue
      const before = sameSeason ? prev[metric] : null
      if (before != null && before >= threshold) continue
      events.push({ type: "threshold", metric, value: now, threshold })
    }
  }
  return events
}

export function diffTeam(prev: TeamSnapshot | null, next: TeamSnapshot): AlertEvent[] {
  if (!prev) return []
  if (prev.season !== next.season) {
    return next.season ? [{ type: "new_season", season: next.season }] : []
  }
  const events: AlertEvent[] = []
  const before = new Set(prev.playerIds)
  const after = new Set(next.playerIds)
  const arrived = next.playerIds.filter((id) => !before.has(id))
  const left = prev.playerIds.filter((id) => !after.has(id))
  if (arrived.length) events.push({ type: "roster_in", playerIds: arrived })
  if (left.length) events.push({ type: "roster_out", playerIds: left })
  if (prev.headCoach && next.headCoach && prev.headCoach !== next.headCoach) {
    events.push({ type: "coach_change", from: prev.headCoach, to: next.headCoach })
  }
  return events
}

/** Thresholds a user may set, with the range the UI and API accept. */
export const THRESHOLD_LIMITS: Record<keyof FollowThresholds, [number, number]> = {
  ppg: [1, 60],
  rpg: [1, 30],
  apg: [1, 20],
  per: [1, 50],
}

export function sanitizeThresholds(input: unknown): FollowThresholds | null {
  if (!input || typeof input !== "object") return null
  const out: FollowThresholds = {}
  for (const [key, [lo, hi]] of Object.entries(THRESHOLD_LIMITS) as Array<
    [keyof FollowThresholds, [number, number]]
  >) {
    const v = (input as Record<string, unknown>)[key]
    if (v == null || v === "") continue
    const n = Number(v)
    if (Number.isFinite(n) && n >= lo && n <= hi) out[key] = Math.round(n * 10) / 10
  }
  return Object.keys(out).length ? out : null
}
