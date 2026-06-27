import { describe, it, expect } from "vitest"
import {
  formatStat,
  formatPct,
  formatInt,
  formatHeight,
  formatWeight,
  ageFrom,
  getInitials,
} from "@/lib/format"

describe("format helpers", () => {
  it("formatStat", () => {
    expect(formatStat(12.345)).toBe("12.3")
    expect(formatStat(12.345, 2)).toBe("12.35")
    expect(formatStat(10, 0, " pts")).toBe("10 pts")
    expect(formatStat(null)).toBe("—")
    expect(formatStat(NaN)).toBe("—")
  })

  it("formatPct", () => {
    expect(formatPct(0.456)).toBe("45.6%")
    expect(formatPct(null)).toBe("—")
  })

  it("formatInt", () => {
    expect(formatInt(1234567)).toBe("1,234,567")
    expect(formatInt(undefined)).toBe("—")
  })

  it("formatHeight", () => {
    expect(formatHeight(203)).toBe("6'8\"")
    expect(formatHeight(null)).toBe("—")
  })

  it("formatWeight", () => {
    expect(formatWeight(95)).toBe("95 kg")
    expect(formatWeight(null)).toBe("—")
  })

  it("ageFrom", () => {
    expect(ageFrom(null)).toBeNull()
    expect(ageFrom("not-a-date")).toBeNull()
    const age = ageFrom("2000-01-01")
    expect(age).toBeGreaterThan(20)
    expect(age).toBeLessThan(100)
  })

  it("getInitials", () => {
    expect(getInitials("Luka Doncic")).toBe("LD")
    expect(getInitials("Giannis Antetokounmpo Long", 3)).toBe("GAL")
    expect(getInitials("madonna")).toBe("M")
    expect(getInitials("   ")).toBe("")
  })
})
