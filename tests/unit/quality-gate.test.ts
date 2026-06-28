import { describe, it, expect } from "vitest"
import { judgeBatch, type ScrapeBatch } from "@/lib/sync/quality-gate"
import type { ExtractedPlayerStat } from "@/lib/sources/types"

function statLine(over: Partial<ExtractedPlayerStat> = {}): ExtractedPlayerStat {
  return {
    playerSourceId: "p",
    season: 2025,
    gamesPlayed: 10,
    minutesTotal: 250,
    pointsTotal: 120,
    reboundsTotal: 40,
    assistsTotal: 30,
    stealsTotal: 10,
    blocksTotal: 5,
    fgMade: 40,
    fgAttempted: 90,
    threeMade: 10,
    threeAttempted: 30,
    ftMade: 20,
    ftAttempted: 25,
    offensiveRebounds: 10,
    defensiveRebounds: 30,
    foulsTotal: 20,
    plusMinus: 5,
    per: null,
    trueShootingPct: null,
    winShares: null,
    bpm: null,
    ...over,
  }
}

function batch(over: Partial<ScrapeBatch> = {}): ScrapeBatch {
  return {
    teams: [{ sourceId: "t1", name: "Team 1" }],
    players: [{ sourceId: "p1", fullName: "Player One" }],
    stats: [statLine()],
    ...over,
  }
}

describe("quality gate — judgeBatch", () => {
  it("passes a healthy batch", () => {
    const v = judgeBatch(batch({ stats: Array(30).fill(statLine()) }), 28)
    expect(v.ok).toBe(true)
    expect(v.reasons).toHaveLength(0)
  })

  it("blocks an empty batch (hard floors)", () => {
    const v = judgeBatch({ teams: [], players: [], stats: [] }, 100)
    expect(v.ok).toBe(false)
    expect(v.reasons).toEqual(
      expect.arrayContaining([
        "0 teams scraped",
        "0 players scraped",
        "0 stat lines scraped",
      ]),
    )
  })

  it("blocks when most played lines are blank (broken parser)", () => {
    const blank = statLine({
      pointsTotal: 0,
      reboundsTotal: 0,
      assistsTotal: 0,
      minutesTotal: 0,
    })
    const stats = [...Array(9).fill(blank), statLine()] // 90% blank
    const v = judgeBatch(batch({ stats }), 10)
    expect(v.ok).toBe(false)
    expect(v.reasons.some((r) => r.includes("blank"))).toBe(true)
  })

  it("blocks a sharp regression vs. baseline", () => {
    // 10 lines now, 100 stored before → >50% loss.
    const v = judgeBatch(batch({ stats: Array(10).fill(statLine()) }), 100)
    expect(v.ok).toBe(false)
    expect(v.reasons.some((r) => r.includes("collapsed"))).toBe(true)
  })

  it("ignores the shrink check when there is no real baseline", () => {
    // First-ever sync: baseline below the minimum, so a small batch is fine.
    const v = judgeBatch(batch({ stats: [statLine()] }), 0)
    expect(v.ok).toBe(true)
  })
})
