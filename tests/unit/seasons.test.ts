import { describe, it, expect } from "vitest"
import {
  ALL_SEASONS,
  CURRENT_SEASON_LABEL,
  CURRENT_SEASON_START_YEAR,
  canonicalSeasonLabel,
  compareSeasonsDesc,
  isSeasonLabel,
  parseSeasonParam,
  previousSeasonLabel,
  seasonLabel,
  seasonNameVariants,
  seasonStartYear,
} from "@/lib/seasons"
import { SOURCE_META } from "@/lib/sources/types"

describe("season labels", () => {
  it("derives the label from a start year", () => {
    expect(seasonLabel(2026)).toBe("2026-27")
    expect(seasonLabel(2025)).toBe("2025-26")
    // The century roll is the one that a naive `+ 1` slice gets wrong.
    expect(seasonLabel(2099)).toBe("2099-00")
  })

  it("exposes the configured current season", () => {
    expect(CURRENT_SEASON_LABEL).toBe(seasonLabel(CURRENT_SEASON_START_YEAR))
  })

  it("parses both the canonical label and the legacy EuroLeague code", () => {
    expect(seasonStartYear("2026-27")).toBe(2026)
    expect(seasonStartYear("E2025")).toBe(2025)
    expect(seasonStartYear("2024")).toBe(2024)
    expect(seasonStartYear("not a season")).toBeNull()
    expect(seasonStartYear(null)).toBeNull()
  })

  it("canonicalises a legacy EuroLeague season name", () => {
    expect(canonicalSeasonLabel("E2025")).toBe("2025-26")
    expect(canonicalSeasonLabel("2025-26")).toBe("2025-26")
    // Unrecognised names are left alone rather than mangled.
    expect(canonicalSeasonLabel("Preseason")).toBe("Preseason")
  })

  it("orders newest first, with E-codes in their real place", () => {
    // Plain string sorting puts "E2025" ahead of "2026-27" because the letter
    // beats the digit — the bug that pinned the EuroLeague card to a stale
    // season once the new label existed.
    const sorted = ["2024-25", "E2025", "2026-27"].sort(compareSeasonsDesc)
    expect(sorted).toEqual(["2026-27", "E2025", "2024-25"])
  })

  it("matches every stored spelling of one season", () => {
    expect(seasonNameVariants("2026-27")).toEqual(["2026-27", "E2026"])
    expect(seasonNameVariants("E2025")).toEqual(["2025-26", "E2025"])
  })

  it("knows the previous season", () => {
    expect(previousSeasonLabel("2026-27")).toBe("2025-26")
    expect(previousSeasonLabel("nonsense")).toBeNull()
  })

  it("recognises valid labels", () => {
    expect(isSeasonLabel("2026-27")).toBe(true)
    expect(isSeasonLabel("")).toBe(false)
    expect(isSeasonLabel(undefined)).toBe(false)
  })
})

describe("parseSeasonParam", () => {
  it("accepts a canonical label and the all-seasons sentinel", () => {
    expect(parseSeasonParam("2026-27")).toBe("2026-27")
    expect(parseSeasonParam(ALL_SEASONS)).toBe(ALL_SEASONS)
  })

  it("normalises a legacy label", () => {
    expect(parseSeasonParam("E2025")).toBe("2025-26")
    expect(parseSeasonParam("  2025-26  ")).toBe("2025-26")
  })

  it("rejects junk so the page falls back to the newest season", () => {
    // Returning undefined (not an empty filter) is what keeps a hand-edited or
    // stale `?season=` from emptying a directory.
    expect(parseSeasonParam("'; DROP TABLE seasons;--")).toBeUndefined()
    expect(parseSeasonParam("latest")).toBeUndefined()
    expect(parseSeasonParam(null)).toBeUndefined()
    expect(parseSeasonParam("")).toBeUndefined()
  })
})

describe("source season configuration", () => {
  it("gives every league the same season LABEL", () => {
    const labels = new Set(
      Object.values(SOURCE_META).map((m) => m.seasonLabel),
    )
    // One shared label is what makes a global season filter possible at all.
    expect([...labels]).toEqual([CURRENT_SEASON_LABEL])
  })

  it("keeps the EuroLeague feed code separate from the label", () => {
    expect(SOURCE_META.euroleague.seasonCode).toBe(
      `E${CURRENT_SEASON_START_YEAR}`,
    )
    expect(SOURCE_META.euroleague.seasonLabel).toBe(CURRENT_SEASON_LABEL)
  })

  it("derives every source's season from the single knob", () => {
    for (const meta of Object.values(SOURCE_META)) {
      expect(meta.season).toBe(CURRENT_SEASON_START_YEAR)
    }
  })
})
