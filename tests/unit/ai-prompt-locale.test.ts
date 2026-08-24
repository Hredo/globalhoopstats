import { describe, it, expect } from "vitest"
import { buildSystemPrompt, type GenerateAdvisorInput } from "@/lib/ai/llm"
import { promptCopy } from "@/lib/ai/prompt-copy"
import type { Locale } from "@/lib/i18n/config"

/**
 * Minimal stand-in for a TeamProfile. buildSystemPrompt only reads name,
 * league and roster, so the rest of the shape is irrelevant here.
 */
function input(locale: Locale): GenerateAdvisorInput {
  return {
    team: {
      id: "t1",
      name: "Valencia Basket",
      league: { name: "Liga ACB", region: "Europe" },
      roster: [
        { fullName: "Player One", position: "PG" },
        { fullName: "Player Two", position: "C" },
      ],
    },
    userMessage: "I need a scoring wing",
    history: [],
    locale,
    teamBudget: { eur: 8_000_000, source: "known" },
    operation: "signing",
  } as unknown as GenerateAdvisorInput
}

// Words that only ever appear in the Spanish scaffolding. If one of these turns
// up in an English prompt, some hardcoded Spanish has crept back in — which is
// what made the model answer English questions with Spanish headings.
const SPANISH_MARKERS = [
  "Presupuesto",
  "fichaje",
  "jugadores",
  "Prioriza",
  "por confirmar",
  "El usuario",
  "Según",
  "No he encontrado",
  "Paquetes",
  "plantilla",
]

describe("buildSystemPrompt", () => {
  it("builds an English prompt with no Spanish scaffolding", () => {
    const prompt = buildSystemPrompt(input("en"))
    for (const marker of SPANISH_MARKERS) {
      expect(prompt, `English prompt leaked "${marker}"`).not.toContain(marker)
    }
  })

  it("builds a Spanish prompt with Spanish scaffolding", () => {
    const prompt = buildSystemPrompt(input("es"))
    expect(prompt).toContain("Presupuesto anual aprox.")
    expect(prompt).toContain("FICHAR")
  })

  it("names the answer language explicitly in both locales", () => {
    expect(buildSystemPrompt(input("en"))).toContain("in English")
    expect(buildSystemPrompt(input("es"))).toContain("in Spanish")
  })

  it("confines the model to players we can actually price", () => {
    // The prompt used to invite names from any league in the world with a
    // "not in our data" tag. Weak models dropped the tag and recommended
    // retired or invented players, so the list is closed now.
    for (const locale of ["en", "es"] as const) {
      const prompt = buildSystemPrompt(input(locale))
      expect(prompt).toContain(promptCopy(locale).onlyListedPlayers)
      expect(prompt).not.toMatch(/any other league worldwide|cualquier otra liga del mundo/i)
    }
  })

  it("has no operation guidance that reopens the closed list", () => {
    for (const locale of ["en", "es"] as const) {
      const guidance = Object.values(promptCopy(locale).operation).join(" ")
      expect(guidance).not.toMatch(
        /anywhere in the world|resto del mundo|DB|base de datos/i,
      )
    }
  })

  it("still carries the team data in both locales", () => {
    for (const locale of ["en", "es"] as const) {
      const prompt = buildSystemPrompt(input(locale))
      expect(prompt).toContain("Valencia Basket")
      expect(prompt).toContain("Liga ACB")
    }
  })
})

describe("promptCopy", () => {
  it("falls back to English for an unknown locale", () => {
    expect(promptCopy("de" as Locale)).toBe(promptCopy("en"))
  })

  it("keeps the two packs structurally identical", () => {
    expect(Object.keys(promptCopy("es")).sort()).toEqual(
      Object.keys(promptCopy("en")).sort(),
    )
    expect(Object.keys(promptCopy("es").operation).sort()).toEqual(
      Object.keys(promptCopy("en").operation).sort(),
    )
  })
})
