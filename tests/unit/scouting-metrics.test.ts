import { describe, expect, it } from "vitest"
import {
  metricValues,
  paceFactor,
  percentileOf,
  percentileProfile,
  qualifies,
  type RawLine,
} from "@/lib/scouting/metrics"
import {
  actual,
  learnFactors,
  MIN_TRANSITIONS,
  modelFactors,
  project,
  type Transition,
} from "@/lib/scouting/projection-model"

function line(over: Partial<RawLine> = {}): RawLine {
  return {
    gamesPlayed: 20,
    minutesTotal: 500,
    pointsTotal: 250,
    reboundsTotal: 100,
    assistsTotal: 60,
    stealsTotal: 20,
    blocksTotal: 10,
    fgMade: 90,
    fgAttempted: 200,
    threeMade: 30,
    threeAttempted: 90,
    ftMade: 40,
    ftAttempted: 50,
    per: 15,
    ...over,
  }
}

describe("metricValues", () => {
  it("per game divides by games", () => {
    expect(metricValues(line(), "perGame").pts).toBe(12.5)
  })
  it("per 40 divides by minutes", () => {
    expect(metricValues(line(), "per40").pts).toBe(20)
  })
  it("pace adjustment only touches counting stats", () => {
    const v = metricValues(line(), "per40pace", 1.1)
    expect(v.pts).toBeCloseTo(22)
    expect(v.ts).toBe(metricValues(line(), "per40").ts)
  })
  it("hides a three-point percentage on too few attempts", () => {
    expect(metricValues(line({ threeMade: 3, threeAttempted: 4 }), "perGame").three).toBeNull()
  })
})

describe("paceFactor", () => {
  it("is neutral when a pace is missing", () => {
    expect(paceFactor(null, 72)).toBe(1)
    expect(paceFactor(70, null)).toBe(1)
  })
  it("scales a slow team up and is clamped", () => {
    expect(paceFactor(60, 72)).toBeCloseTo(1.2)
    expect(paceFactor(20, 72)).toBe(1.25)
  })
})

describe("percentiles", () => {
  it("counts ties as half and needs a real field", () => {
    expect(percentileOf(5, [1, 2, 3, 4, 5, 6, 7, 8])).toBe(56)
    expect(percentileOf(5, [1, 2, 3])).toBeNull()
  })
  it("builds a profile key by key", () => {
    const field = Array.from({ length: 10 }, (_, i) =>
      metricValues(line({ pointsTotal: 100 + i * 20 }), "perGame"),
    )
    const p = percentileProfile(metricValues(line({ pointsTotal: 280 }), "perGame"), field)
    // 280 is the top of the field and ties with itself: 9 below + half a tie.
    expect(p.pts.percentile).toBe(95)
  })
  it("does not rank a cameo per 40", () => {
    expect(qualifies(line({ minutesTotal: 60 }), "per40")).toBe(false)
    expect(qualifies(line({ gamesPlayed: 2 }), "perGame")).toBe(false)
  })
})

describe("projection model", () => {
  const mover = (k: number): Transition => ({
    from: line({ pointsTotal: 300 + k, minutesTotal: 600 }),
    // Up a level: scoring rate drops 20 %, minutes drop 25 %.
    to: line({ pointsTotal: Math.round((300 + k) * 0.8 * 0.75), minutesTotal: 450 }),
  })

  it("refuses to learn from too few movers", () => {
    expect(learnFactors(Array.from({ length: MIN_TRANSITIONS - 1 }, (_, i) => mover(i)))).toBeNull()
  })

  it("learns the median per-40 change and the minutes change", () => {
    const f = learnFactors(Array.from({ length: 12 }, (_, i) => mover(i)))!
    expect(f.method).toBe("transitions")
    expect(f.sample).toBe(12)
    expect(f.rate.pts).toBeCloseTo(0.8, 1)
    expect(f.minutes).toBeCloseTo(0.75, 2)
  })

  it("falls back to a damped strength ratio", () => {
    const f = modelFactors(0.28 / 0.52)
    expect(f.method).toBe("model")
    expect(f.rate.pts).toBeCloseTo(Math.sqrt(0.28 / 0.52))
    expect(f.minutes).toBeLessThan(1)
  })

  it("projects per game from per 40 and the new role", () => {
    const base = line()
    const p = project(base, modelFactors(1))
    expect(p.perGame.pts).toBeCloseTo(actual(base).perGame.pts!)
    const down = project(base, modelFactors(0.25))
    expect(down.perGame.pts!).toBeLessThan(actual(base).perGame.pts!)
    expect(down.minutesPerGame!).toBeLessThanOrEqual(38)
  })
})
