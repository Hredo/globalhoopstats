import { describe, expect, it } from "vitest"
import { slugify, trimDashes } from "@/lib/sync/slug"

describe("trimDashes", () => {
  it("strips leading and trailing dashes only", () => {
    expect(trimDashes("--real-madrid--")).toBe("real-madrid")
    expect(trimDashes("----")).toBe("")
    expect(trimDashes("")).toBe("")
    expect(trimDashes("a")).toBe("a")
  })

  it("stays linear on a long dash run that does not end the string", () => {
    // `/^-+|-+$/` backtracks quadratically on exactly this (CodeQL js/polynomial-redos).
    const hostile = `${"-".repeat(100_000)}x`
    const started = performance.now()
    expect(trimDashes(hostile)).toBe("x")
    expect(performance.now() - started).toBeLessThan(100)
  })
})

describe("slugify", () => {
  it("keeps producing the same slugs", () => {
    expect(slugify("  Río Breogán ")).toBe("rio-breogan")
    expect(slugify("Kids&Us Manresa")).toBe("kids-us-manresa")
    expect(slugify("¡¡¡")).toBe("")
  })

  it("handles hostile team names from request bodies quickly", () => {
    const started = performance.now()
    expect(slugify(`${"!".repeat(100_000)}x`)).toBe("x")
    expect(performance.now() - started).toBeLessThan(200)
  })
})
