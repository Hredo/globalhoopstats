import type { ShotZoneKey, ShotZonesJson } from "@/lib/db/schema"

/*
 * Per-zone shooting from shot-by-shot data, for the leagues that publish it.
 *
 * EuroLeague's play feed carries court coordinates for every field-goal attempt
 * and the NBA's shotchartdetail classifies every shot itself; both land in the
 * same eleven half-court buckets the player shot chart draws. ACB and FEB show
 * shot charts on their own live sites, but only through APIs that need an
 * access key, so their players have no zones (see DATA-SOURCES.md).
 */

export type SourceShotZones = {
  playerSourceId: string
  teamSourceId: string
  zones: ShotZonesJson
}

/**
 * Bucket a shot by its court coordinates. Origin is the basket; x is lateral
 * (negative = left from the shooter's view), y is distance up-court, both in cm.
 * The 2-vs-3 flag comes from the play type, so geometry only decides the paint
 * radius and the corner / wing / top angle.
 */
export function classifyShotZone(
  x: number,
  y: number,
  is3: boolean,
): ShotZoneKey {
  if (!is3 && Math.hypot(x, y) <= 300) return "paint"
  const side = x < 0 ? "left" : "right"
  const deg = (Math.atan2(y, Math.abs(x)) * 180) / Math.PI // 0 = baseline, 90 = top
  const suffix = is3 ? "3" : "2"
  if (deg >= 63) return `frontal${suffix}`
  return `${side}${deg < 25 ? "Corner" : "Wing"}${suffix}`
}

/** stats.nba.com's own zone labels (SHOT_ZONE_BASIC / SHOT_ZONE_AREA) → our buckets. */
export function nbaShotZone(basic: string, area: string): ShotZoneKey | null {
  const b = basic.trim()
  const a = area.trim()
  const side = a.startsWith("Left")
    ? "left"
    : a.startsWith("Right")
      ? "right"
      : "center"
  if (b === "Restricted Area" || b === "In The Paint (Non-RA)") return "paint"
  if (b === "Left Corner 3") return "leftCorner3"
  if (b === "Right Corner 3") return "rightCorner3"
  if (b === "Above the Break 3")
    return side === "center"
      ? "frontal3"
      : side === "left"
        ? "leftWing3"
        : "rightWing3"
  if (b === "Mid-Range") {
    if (side === "center") return "frontal2"
    if (a === "Left Side(L)") return "leftCorner2"
    if (a === "Right Side(R)") return "rightCorner2"
    return side === "left" ? "leftWing2" : "rightWing2"
  }
  return null // backcourt heaves
}

/** Accumulates made/attempted per (player, team) and zone. */
export class ShotZoneTally {
  private readonly byKey = new Map<string, SourceShotZones>()

  add(
    playerSourceId: string,
    teamSourceId: string,
    zone: ShotZoneKey,
    made: number,
    attempted = 1,
  ): void {
    const key = `${playerSourceId}::${teamSourceId}`
    let entry = this.byKey.get(key)
    if (!entry) {
      entry = { playerSourceId, teamSourceId, zones: {} }
      this.byKey.set(key, entry)
    }
    const z = (entry.zones[zone] ??= { m: 0, a: 0 })
    z.a += attempted
    z.m += made
  }

  addAll(lines: Iterable<SourceShotZones>): void {
    for (const line of lines)
      for (const [zone, z] of Object.entries(line.zones))
        this.add(
          line.playerSourceId,
          line.teamSourceId,
          zone as ShotZoneKey,
          z.m,
          z.a,
        )
  }

  lines(): SourceShotZones[] {
    return [...this.byKey.values()]
  }
}
