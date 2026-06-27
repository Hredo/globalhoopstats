import { describe, it, expect } from "vitest"
import {
  isLocale,
  pickFromAcceptLanguage,
  localeCookie,
  LOCALE_COOKIE,
  DEFAULT_LOCALE,
} from "@/lib/i18n/config"

describe("isLocale", () => {
  it("accepts supported locales only", () => {
    expect(isLocale("en")).toBe(true)
    expect(isLocale("es")).toBe(true)
    expect(isLocale("fr")).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(123)).toBe(false)
  })
})

describe("pickFromAcceptLanguage", () => {
  it("returns default for missing header", () => {
    expect(pickFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE)
    expect(pickFromAcceptLanguage("")).toBe(DEFAULT_LOCALE)
  })

  it("picks Spanish when prioritised", () => {
    expect(pickFromAcceptLanguage("es-ES,es;q=0.9,en;q=0.5")).toBe("es")
  })

  it("picks English when prioritised", () => {
    expect(pickFromAcceptLanguage("en-US,en;q=0.9")).toBe("en")
  })

  it("respects q-weights over order", () => {
    expect(pickFromAcceptLanguage("en;q=0.2, es;q=0.9")).toBe("es")
  })

  it("falls back to default for unsupported languages", () => {
    expect(pickFromAcceptLanguage("de-DE,fr;q=0.8")).toBe(DEFAULT_LOCALE)
  })
})

describe("localeCookie", () => {
  it("builds a year-long lax cookie", () => {
    const c = localeCookie("es")
    expect(c).toContain(`${LOCALE_COOKIE}=es`)
    expect(c).toContain("SameSite=Lax")
    expect(c).toContain("Path=/")
    expect(c).toMatch(/Max-Age=\d+/)
  })
})
