import { describe, expect, it } from "vitest"
import { isInSeason } from "@/lib/sync/season-window"

const d = (month: number) => new Date(2026, month - 1, 15) // month is 1-based here

describe("isInSeason", () => {
  it("treats July/August as off-season for every source", () => {
    for (const m of [7, 8]) {
      expect(isInSeason("nba", d(m))).toBe(false)
      expect(isInSeason("acb", d(m))).toBe(false)
      expect(isInSeason("euroleague", d(m))).toBe(false)
      expect(isInSeason("leb-oro", d(m))).toBe(false)
      expect(isInSeason("eba", d(m))).toBe(false)
    }
  })

  it("keeps the European leagues active September–June", () => {
    for (const m of [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]) {
      expect(isInSeason("acb", d(m))).toBe(true)
      expect(isInSeason("leb-plata", d(m))).toBe(true)
    }
  })

  it("sleeps the NBA in September but runs it Oct–June", () => {
    expect(isInSeason("nba", d(9))).toBe(false)
    expect(isInSeason("nba", d(10))).toBe(true)
    expect(isInSeason("nba", d(6))).toBe(true)
  })

  it("is in season for all sources in June (current month sanity)", () => {
    for (const s of ["nba", "acb", "euroleague", "leb-oro", "leb-plata", "eba"] as const) {
      expect(isInSeason(s, d(6))).toBe(true)
    }
  })
})
