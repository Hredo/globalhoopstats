import { describe, it, expect } from "vitest"
import {
  buildPlayerPrompt,
  playerReportSystem,
} from "@/lib/ai/player-report"
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

/**
 * The DATA turn. Instructions moved to `playerReportSystem` — sent in the user
 * turn they were paraphrased back as the answer (see the compare screen).
 */
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

/** The BRIEF. What the two halves say together is what reaches the model. */
function brief(
  zones: ShotZonesJson | null,
  canBrowse = false,
  locale: "en" | "es" = "en",
) {
  return playerReportSystem(locale, { hasShotChart: zones !== null, canBrowse })
}

describe("player scouting note prompt", () => {
  it("asks for a weakness section, which the old template never guaranteed", () => {
    expect(brief(null)).toContain("Where he falls short")
  })

  it("drops the shooting section when the league publishes no zone data", () => {
    expect(brief(null)).not.toContain("Where he scores from")
    expect(build(null)).not.toContain("Shooting by zone")
  })

  it("includes real zone percentages when they exist", () => {
    const prompt = build(REAL_ZONES)
    expect(prompt).toContain("Shooting by zone (real, from shot-location data)")
    expect(prompt).toContain("Paint: 60.0% (90/150)")
    expect(brief(REAL_ZONES)).toContain("Where he scores from")
  })

  it("ignores a zone with too few attempts to mean anything", () => {
    // 3/4 from the right corner is noise, not a 75% shooter.
    expect(build(REAL_ZONES)).not.toContain("Right corner")
  })

  it("only asks about reputation when the engine can actually browse", () => {
    expect(brief(null, false)).not.toContain("Reputation")
    expect(brief(null, true)).toContain("Reputation")
  })

  it("never asks the model to announce what it could not do", () => {
    // Two of the old six sections were reliably "Cannot assess X without
    // internet access" — filler the reader had to skip past.
    for (const canBrowse of [true, false]) {
      const prompt = brief(REAL_ZONES, canBrowse)
      expect(prompt).not.toMatch(/Cannot assess/i)
      expect(prompt).not.toMatch(/lack internet access/i)
    }
    expect(brief(null)).toContain("Leave a point out entirely")
  })

  it("does not impose the rigid six-line template any more", () => {
    const prompt = brief(REAL_ZONES, true)
    expect(prompt).not.toMatch(/exactly 6 lines/i)
    expect(prompt).not.toMatch(/Section \d/)
  })

  it("carries the plain-language rules in the reader's language", () => {
    expect(brief(null, false, "en")).toContain("not for a data analyst")
    expect(brief(null, false, "es")).toContain("no para un analista de datos")
  })

  it("labels the sections in the reader's language", () => {
    expect(brief(null, false, "es")).toContain("Dónde flojea")
    expect(brief(null, false, "es")).not.toContain("Where he falls short")
  })

  it("keeps instructions out of the data turn", () => {
    // The whole point of the split: a small model reads the user turn as
    // material and answers it. The data half must carry no orders.
    const data = build(REAL_ZONES, true, "es")
    expect(data).not.toContain("Formato:")
    expect(data).not.toContain("Dónde flojea")
    expect(data).not.toMatch(/no para un analista de datos/)
  })
})
