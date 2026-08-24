import { describe, it, expect } from "vitest"
import { tradeInstructions } from "@/lib/ai/trade-instructions"
import { LOCALES } from "@/lib/i18n/config"

/**
 * The complaint these guard against: every scenario in the same simulation
 * came back in a different shape, and the figures in the text contradicted the
 * card printed next to it (a €57M player described as worth €60M, ages and
 * contracts invented outright).
 */
describe("trade report instructions", () => {
  for (const locale of LOCALES) {
    it(`${locale}: pins one structure so two reports can be compared`, () => {
      const text = tradeInstructions(locale).join("\n")
      expect(text).toMatch(/^1\./m)
      expect(text).toMatch(/^2\./m)
      expect(text).toMatch(/^3\./m)
      expect(text).toMatch(/(Veredicto|Verdict)/)
      // A hard word cap: a small model given room to ramble does.
      expect(text).toMatch(/180/)
    })

    it(`${locale}: forbids any number that is not in the data block`, () => {
      const text = tradeInstructions(locale).join("\n")
      expect(text).toMatch(
        /only numbers that exist|únicos números que existen/i,
      )
      expect(text).toMatch(/contract|contrato/i)
      expect(text).toMatch(/league|liga/i)
    })

    it(`${locale}: is written in the reader's language`, () => {
      const text = tradeInstructions(locale).join("\n")
      if (locale === "es") {
        expect(text).toContain("INSTRUCCIONES")
        expect(text).not.toContain("INSTRUCTIONS")
      } else {
        expect(text).toContain("INSTRUCTIONS")
        expect(text).not.toContain("INSTRUCCIONES")
      }
    })

    it(`${locale}: does not ask the model to repeat the stat sheet on screen`, () => {
      const text = tradeInstructions(locale).join("\n")
      expect(text).toMatch(/no repitas la ficha|do not repeat the stat sheet/i)
    })
  }
})
