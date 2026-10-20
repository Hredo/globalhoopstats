import { describe, it, expect } from "vitest"
import { buildCareerTimeline } from "@/lib/scouting/career"
import type { PlayerCareerLine } from "@/lib/data/players"

const LEAGUES = {
  eba: "Tercera FEB",
  "leb-plata": "Segunda FEB",
  "leb-oro": "Primera FEB",
  acb: "Liga ACB",
  euroleague: "EuroLeague",
} as const

function line(
  seasonName: string,
  league: keyof typeof LEAGUES,
  team: string | null,
  gamesPlayed: number,
  pointsTotal: number | null = gamesPlayed * 10,
): PlayerCareerLine {
  return {
    seasonId: `${seasonName}-${league}`,
    seasonName,
    gamesPlayed,
    pointsTotal,
    reboundsTotal: null,
    assistsTotal: null,
    stealsTotal: null,
    blocksTotal: null,
    fgPct: null,
    threePct: null,
    ftPct: null,
    per: null,
    shotZones: null,
    league: { name: LEAGUES[league], slug: league },
    team: team ? { name: team, slug: team } : null,
  }
}

describe("buildCareerTimeline", () => {
  it("orders seasons oldest first and leagues strongest first", () => {
    // allSeasons arrives newest first.
    const tl = buildCareerTimeline([
      line("2025-26", "leb-oro", "a", 30),
      line("2024-25", "leb-plata", "b", 28),
      line("2023-24", "eba", "c", 26),
    ])
    expect(tl.seasons).toEqual(["2023-24", "2024-25", "2025-26"])
    expect(tl.leagues.map((l) => l.slug)).toEqual([
      "leb-oro",
      "leb-plata",
      "eba",
    ])
    expect(tl.points.map((p) => [p.x, p.y])).toEqual([
      [0, 2],
      [1, 1],
      [2, 0],
    ])
  })

  it("marks each step up the ladder", () => {
    const tl = buildCareerTimeline([
      line("2025-26", "leb-oro", "a", 30),
      line("2024-25", "leb-plata", "b", 28),
      line("2023-24", "eba", "c", 26),
    ])
    expect(tl.stints.map((s) => s.move)).toEqual([null, "up", "up"])
  })

  it("merges consecutive seasons with the same club into one stint", () => {
    const tl = buildCareerTimeline([
      line("2025-26", "acb", "x", 30, 300),
      line("2024-25", "acb", "x", 20, 100),
      line("2023-24", "acb", "y", 25),
    ])
    expect(tl.stints).toHaveLength(2)
    expect(tl.stints[1]).toMatchObject({
      from: "2024-25",
      to: "2025-26",
      seasons: 2,
      games: 50,
      ppg: 8,
      move: "transfer",
    })
  })

  it("draws a parallel league that season without breaking the path", () => {
    // Same club in the EuroLeague and the ACB in one season.
    const tl = buildCareerTimeline([
      line("2025-26", "euroleague", "real-madrid", 34),
      line("2025-26", "acb", "real-madrid", 38),
      line("2024-25", "acb", "real-madrid", 36),
    ])
    const last = tl.points.filter((p) => p.season === "2025-26")
    expect(last).toHaveLength(2)
    expect(last.find((p) => p.main)?.y).toBe(0) // EuroLeague row
    // The ACB run continues; the EuroLeague debut is a step up.
    const acb = tl.stints.find((s) => s.league.slug === "acb")
    expect(acb).toMatchObject({ from: "2024-25", to: "2025-26", seasons: 2 })
    expect(tl.stints.find((s) => s.league.slug === "euroleague")?.move).toBe(
      "up",
    )
  })

  it("keeps one stint across seasons missing from the record", () => {
    const tl = buildCareerTimeline([
      line("2025-26", "acb", "x", 30),
      line("2022-23", "acb", "x", 30),
    ])
    expect(tl.seasons).toEqual(["2022-23", "2025-26"])
    // Adjacent columns, so the same club reads as one run.
    expect(tl.stints).toHaveLength(1)
  })

  it("skips lines with no games and keeps ppg null without points", () => {
    const tl = buildCareerTimeline([
      line("2025-26", "acb", "x", 0),
      line("2024-25", "acb", "x", 12, null),
    ])
    expect(tl.seasons).toEqual(["2024-25"])
    expect(tl.stints[0].ppg).toBeNull()
  })

  it("marks a step down the ladder", () => {
    const tl = buildCareerTimeline([
      line("2025-26", "acb", "x", 30),
      line("2024-25", "euroleague", "x", 30),
    ])
    expect(tl.stints.map((s) => s.move)).toEqual([null, "down"])
  })
})
