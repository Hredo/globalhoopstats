import { describe, expect, it } from "vitest"
import { localizeNationality, localizePosition } from "@/lib/i18n/player-labels"

describe("localizePosition", () => {
  it("translates Spanish source positions for English readers", () => {
    expect(localizePosition("Alero", "en")).toBe("Small forward")
    expect(localizePosition("A-Pivot", "en")).toBe("Power forward")
    expect(localizePosition("Pívot", "en")).toBe("Center")
  })

  it("translates English source positions for Spanish readers", () => {
    expect(localizePosition("Forward", "es")).toBe("Alero")
    expect(localizePosition("Point guard", "es")).toBe("Base")
  })

  it("passes abbreviations and unknown values through", () => {
    expect(localizePosition("G-F", "en")).toBe("G-F")
    expect(localizePosition("C", "es")).toBe("C")
    expect(localizePosition(null, "es")).toBeNull()
  })
})

describe("localizeNationality", () => {
  it("renders Spanish country names in English and vice versa", () => {
    expect(localizeNationality("Croacia", "en")).toBe("Croatia")
    expect(localizeNationality("Spain", "es")).toBe("España")
    expect(localizeNationality("Belgica", "en")).toBe("Belgium")
  })

  it("understands the sources' own spellings", () => {
    expect(localizeNationality("USA", "es")).toBe("Estados Unidos")
    expect(localizeNationality("R. Checa", "en")).toBe("Czechia")
    expect(localizeNationality("Cabo Verde", "en")).toBe("Cape Verde")
  })

  it("keeps the same language untouched and unknown values as they are", () => {
    expect(localizeNationality("España", "es")).toBe("España")
    expect(localizeNationality("Atlantis", "en")).toBe("Atlantis")
  })
})
