import { describe, it, expect } from "vitest"
import { AI_PROVIDERS } from "@/lib/ai/providers"
import { providerCopy } from "@/lib/ai/provider-copy"
import { LOCALES } from "@/lib/i18n/config"

describe("providerCopy", () => {
  it("has real copy for every catalogue provider in every locale", () => {
    for (const provider of AI_PROVIDERS) {
      for (const locale of LOCALES) {
        const copy = providerCopy(provider.id, locale)
        expect(
          copy.blurb.length,
          `${provider.id} has no ${locale} blurb`,
        ).toBeGreaterThan(20)
        expect(
          copy.guide.length,
          `${provider.id} has no ${locale} guide steps`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it("actually translates the copy rather than reusing English", () => {
    // The setup guide used to pair a Spanish blurb with English steps, so it
    // read as broken whichever language you picked.
    const untranslated = AI_PROVIDERS.filter((p) => {
      const en = providerCopy(p.id, "en")
      const es = providerCopy(p.id, "es")
      return en.blurb === es.blurb
    }).map((p) => p.id)
    expect(untranslated).toEqual([])
  })

  it("keeps the guide the same length in both languages", () => {
    for (const provider of AI_PROVIDERS) {
      expect(
        providerCopy(provider.id, "es").guide.length,
        `${provider.id} guide length differs between locales`,
      ).toBe(providerCopy(provider.id, "en").guide.length)
    }
  })

  it("falls back to English for an unknown locale", () => {
    expect(
      providerCopy("openai", "de" as (typeof LOCALES)[number]).blurb,
    ).toBe(providerCopy("openai", "en").blurb)
  })

  it("returns an empty shape for an unknown provider instead of throwing", () => {
    const copy = providerCopy("does-not-exist", "en")
    expect(copy.blurb).toBe("")
    expect(copy.guide).toEqual([])
  })
})
