import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { houseStyle, promptCopy } from "@/lib/ai/prompt-copy"
import { LOCALES } from "@/lib/i18n/config"

/**
 * Every AI surface must share one voice. These read the sources rather than
 * calling the routes, because the routes need a database and a provider key —
 * but the prompt text is what actually decides how the answer reads.
 */
const SURFACES: Record<string, string> = {
  advisor: "src/lib/ai/llm.ts",
  playerReport: "src/lib/ai/player-report.ts",
  compare: "src/app/api/compare/ai/route.ts",
  trade: "src/app/api/market/trade/ai/route.ts",
  playbook: "src/app/api/playbooks/ai/route.ts",
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8")
}

describe("house style reaches every AI surface", () => {
  for (const [name, rel] of Object.entries(SURFACES)) {
    it(`${name} applies the shared plain-language rules`, () => {
      const src = source(rel)
      // llm.ts and player-report.ts inline the rules via copy.plainLanguage;
      // the routes pull in the ready-made block.
      const uses = src.includes("houseStyle(") || src.includes("plainLanguage")
      expect(uses, `${rel} does not apply the house style`).toBe(true)
    })
  }
})

describe("houseStyle", () => {
  it("renders as a usable prompt block in both languages", () => {
    for (const locale of LOCALES) {
      const block = houseStyle(locale)
      expect(block.startsWith("## ")).toBe(true)
      // One bullet per rule, joined with real newlines rather than a literal
      // backslash-n (a collapsed escape would ship the whole block as one line).
      const bullets = block.split("\n").filter((l) => l.startsWith("- "))
      expect(bullets).toHaveLength(promptCopy(locale).plainLanguage.length)
      expect(block).not.toContain("\\n")
    }
  })

  it("is written in the reader's language", () => {
    expect(houseStyle("es")).toContain("no para un analista de datos")
    expect(houseStyle("en")).toContain("not for a data analyst")
    expect(houseStyle("es")).not.toContain("data analyst")
  })
})

describe("no surface asks for the patterns that made output unreadable", () => {
  const BANNED: Array<[RegExp, string]> = [
    [/exactly \d+ lines/i, "a fixed line count forces a template"],
    [/Cannot assess/i, "telling the reader what you could not do is filler"],
    [/lack internet access/i, "same — drop the point instead"],
    [/Section \d/, "numbered framework labels leak into the answer"],
  ]
  // A prompt that forbids a pattern necessarily names it, so only lines that
  // ASK for one count. Drop the prohibitions before matching.
  const NEGATED = /\b(never|not|avoid|no|nunca|sin)\b|n't/i
  for (const [name, rel] of Object.entries(SURFACES)) {
    it(`${name} avoids them`, () => {
      const asking = source(rel)
        .split("\n")
        .filter((line) => !NEGATED.test(line))
      for (const [pattern, why] of BANNED) {
        const offender = asking.find((line) => pattern.test(line))
        expect(offender, `${rel}: ${why}`).toBeUndefined()
      }
    })
  }
})

describe("internal jargon stays out of the reader's view", () => {
  it("does not label unknown players with database vocabulary", () => {
    for (const locale of LOCALES) {
      const tag = promptCopy(locale).outOfDbTag
      expect(tag).not.toMatch(/\bDB\b/i)
      expect(tag).not.toMatch(/database|base de datos/i)
    }
  })

  it("tells the model our ratings are estimates, not official figures", () => {
    for (const locale of LOCALES) {
      const rules = promptCopy(locale).plainLanguage.join(" ")
      expect(rules).toMatch(/estimate|estimación/i)
    }
  })
})
