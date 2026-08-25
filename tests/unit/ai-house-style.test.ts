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
  trade: "src/lib/ai/trade-instructions.ts",
  playbook: "src/app/api/playbooks/ai/route.ts",
}

/**
 * Everything that writes instructions for a model, including the files that
 * only hold the domain half and let the route add the shared style on top.
 */
const PROMPT_SOURCES: Record<string, string> = {
  ...SURFACES,
  playbookInstructions: "src/lib/ai/playbook-instructions.ts",
  sharedCopy: "src/lib/ai/prompt-copy.ts",
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
      const copy = promptCopy(locale)
      expect(block.startsWith("## ")).toBe(true)
      // One bullet per rule across both halves, joined with real newlines
      // rather than a literal backslash-n (a collapsed escape would ship the
      // whole block as one line).
      const bullets = block.split("\n").filter((l) => l.startsWith("- "))
      expect(bullets).toHaveLength(
        copy.plainLanguage.length + copy.formatRules.length,
      )
      expect(block).not.toContain("\\n")
    }
  })

  it("carries both halves: how to sound and how to lay it out", () => {
    // The format rules used to live inline in each route, which is how five
    // surfaces ended up with five different templates.
    for (const locale of LOCALES) {
      const headings = houseStyle(locale)
        .split("\n")
        .filter((l) => l.startsWith("## "))
      expect(headings).toHaveLength(2)
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
    // The complaint that prompted this: every surface pinned its own length
    // ("200-350 words", "180 words maximum", "250-450 words"), so each one
    // produced a differently shaped form instead of an answer.
    [/\b\d{2,4}\s*[-–]\s*\d{2,4}\s+(?:words|palabras)\b/i, "a word range is a template"],
    [/\b\d{2,4}\s+(?:words|palabras)\s+(?:maximum|max)\b/i, "a hard word cap is a template"],
    [/\b(?:máximo|maximo)\s+\d{2,4}\s+palabras\b/i, "a hard word cap is a template"],
  ]
  // A prompt that forbids a pattern necessarily names it, so only lines that
  // ASK for one count. Drop the prohibitions before matching — and the
  // comments, which is where a removed pattern gets quoted to explain why it
  // was removed.
  const NEGATED = /\b(never|not|avoid|no|nunca|sin)\b|n't/i
  const COMMENT = /^\s*(?:\/\/|\/\*|\*)/
  for (const [name, rel] of Object.entries(PROMPT_SOURCES)) {
    it(`${name} avoids them`, () => {
      const asking = source(rel)
        .split("\n")
        .filter((line) => !COMMENT.test(line) && !NEGATED.test(line))
      for (const [pattern, why] of BANNED) {
        const offender = asking.find((line) => pattern.test(line))
        expect(offender, `${rel}: ${why}`).toBeUndefined()
      }
    })
  }
})

describe("prompts are written in one language at a time", () => {
  // A prompt written in English with Spanish examples inside it — the playbook
  // brief used to carry "Lo que funciona" and "el bloqueo en el codo" — is a
  // direct instruction to mix languages, and the model obliges.
  const SPANISH_ONLY = /\b(?:jugador|jugadores|entrenador|plantilla|bloqueo|esquina|equipo|análisis|párrafos|tiradores)\b/i
  const ENGLISH_ONLY = /\b(?:player|players|coach|roster|screen|corner|team|analysis|paragraphs|shooters)\b/i

  it("keeps the playbook brief monolingual in each locale", async () => {
    const { playbookInstructions } = await import(
      "@/lib/ai/playbook-instructions"
    )
    expect(playbookInstructions("en")).not.toMatch(SPANISH_ONLY)
    expect(playbookInstructions("es")).not.toMatch(ENGLISH_ONLY)
  })

  it("keeps the house style monolingual in each locale", () => {
    expect(houseStyle("en")).not.toMatch(SPANISH_ONLY)
    expect(houseStyle("es")).not.toMatch(ENGLISH_ONLY)
  })
})

describe("internal jargon stays out of the reader's view", () => {
  it("keeps the closed-list rule free of database vocabulary", () => {
    for (const locale of LOCALES) {
      const rule = promptCopy(locale).onlyListedPlayers
      expect(rule).not.toMatch(/\bDB\b/i)
      expect(rule).not.toMatch(/database|base de datos/i)
    }
  })

  it("tells the model our ratings are estimates, not official figures", () => {
    for (const locale of LOCALES) {
      const rules = promptCopy(locale).plainLanguage.join(" ")
      expect(rules).toMatch(/estimate|estimación/i)
    }
  })
})
