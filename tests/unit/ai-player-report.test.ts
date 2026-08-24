import { describe, it, expect } from "vitest"
import { buildPlayerPrompt } from "@/lib/ai/player-report"
import type { ShotZonesJson } from "@/lib/db/schema"

const season = {
  seasonName: "2025-26",
  gamesPlayed: 30,
  pointsTotal: 480,
  reboundsTotal: 210,
  assistsTotal: 150,
  stealsTotal: 30,
  blocksTotal: 12,
  fgPct: 0.48,
  threePct: 0.37,
  ftPct: 0.84,
  per: 18.4,
}

const market = {
  eur: 1_200_000,
  tier: "Titular",
  rating: 68,
  annualEur: 400_000,
  confidence: "media",
  tsPct: 0.58,
  winShares: 4.2,
  bpm: 2.1,
}

const REAL_ZONES: ShotZonesJson = {
  paint: { m: 90, a: 150 },
  leftCorner3: { m: 12, a: 30 },
  rightCorner3: { m: 3, a: 4 }, // below the attempt floor — must be dropped
}

function build(zones: ShotZonesJson | null, canBrowse = false, locale: "en" | "es" = "en") {
  return buildPlayerPrompt(
    "Jean Montero",
    "Liga ACB",
    "Valencia Basket",
    "PG",
    season,
    market,
    zones,
    locale,
    canBrowse,
  )
}

describe("player scouting note prompt", () => {
  it("asks for a weakness section, which the old template never guaranteed", () => {
    expect(build(null)).toContain("Where he falls short")
  })

  it("drops the shooting section when the league publishes no zone data", () => {
    const prompt = build(null)
    expect(prompt).not.toContain("Where he scores from")
    expect(prompt).not.toContain("Shooting by zone")
  })

  it("includes real zone percentages when they exist", () => {
    const prompt = build(REAL_ZONES)
    expect(prompt).toContain("Shooting by zone (real, from shot-location data)")
    expect(prompt).toContain("Paint: 60.0% (90/150)")
    expect(prompt).toContain("Where he scores from")
  })

  it("ignores a zone with too few attempts to mean anything", () => {
    // 3/4 from the right corner is noise, not a 75% shooter.
    expect(build(REAL_ZONES)).not.toContain("Right corner")
  })

  it("only asks about reputation when the engine can actually browse", () => {
    expect(build(null, false)).not.toContain("Reputation")
    expect(build(null, true)).toContain("Reputation")
  })

  it("never asks the model to announce what it could not do", () => {
    // Two of the old six sections were reliably "Cannot assess X without
    // internet access" — filler the reader had to skip past.
    for (const canBrowse of [true, false]) {
      const prompt = build(REAL_ZONES, canBrowse)
      expect(prompt).not.toMatch(/Cannot assess/i)
      expect(prompt).not.toMatch(/lack internet access/i)
    }
    expect(build(null)).toContain("Leave a point out entirely")
  })

  it("does not impose the rigid six-line template any more", () => {
    const prompt = build(REAL_ZONES, true)
    expect(prompt).not.toMatch(/exactly 6 lines/i)
    expect(prompt).not.toMatch(/Section \d/)
  })

  it("carries the plain-language rules in the reader's language", () => {
    expect(build(null, false, "en")).toContain("not for a data analyst")
    expect(build(null, false, "es")).toContain("no para un analista de datos")
  })

  it("labels the sections in the reader's language", () => {
    expect(build(null, false, "es")).toContain("Dónde flojea")
    expect(build(null, false, "es")).not.toContain("Where he falls short")
  })
})
