import { describe, it, expect } from "vitest"
import { buildSystemPrompt, type GenerateAdvisorInput } from "@/lib/ai/llm"
import { promptCopy } from "@/lib/ai/prompt-copy"
import type { Locale } from "@/lib/i18n/config"

/**
 * Minimal stand-in for a TeamProfile. buildSystemPrompt only reads name,
 * league and roster, so the rest of the shape is irrelevant here.
 */
function input(
  locale: Locale,
  extra: Partial<GenerateAdvisorInput> = {},
): GenerateAdvisorInput {
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
    ...extra,
  } as unknown as GenerateAdvisorInput
}

/** One priced candidate, enough to make the shortlist section render. */
function withCandidate(locale: Locale): GenerateAdvisorInput {
  return input(locale, {
    candidates: [
      {
        reason: "fills the shooting gap",
        player: {
          fullName: "Jean Montero",
          position: "SG",
          age: 22,
          league: { name: "Liga ACB" },
          team: { name: "Valencia Basket" },
          valuation: {
            eur: 900_000,
            tier: "rotation",
            rating: 62,
            leagueSlug: "acb",
          },
        },
      },
    ] as unknown as GenerateAdvisorInput["candidates"],
  })
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

  // The other half of the same bug, and the one nobody was guarding: the
  // instruction spine was hardcoded English while only the fragments were
  // translated, so a Spanish answer was written off an English rulebook.
  const ENGLISH_MARKERS = [
    "You are",
    "How to write",
    "Roster:",
    "Position distribution",
    "Core rotation",
    "The user's team",
    "Player mentioned",
    "Do not invent",
  ]

  it("builds a Spanish prompt with no English scaffolding", () => {
    const prompt = buildSystemPrompt(
      withCandidate("es") as GenerateAdvisorInput,
    )
    for (const marker of ENGLISH_MARKERS) {
      expect(prompt, `Spanish prompt leaked "${marker}"`).not.toContain(marker)
    }
  })

  it("names the answer language explicitly in both locales", () => {
    expect(buildSystemPrompt(input("en"))).toContain("English")
    expect(buildSystemPrompt(input("es"))).toContain("Spanish")
  })

  it("confines RECOMMENDATIONS to players we can actually price", () => {
    // The prompt used to invite names from any league in the world with a
    // "not in our data" tag. Weak models dropped the tag and recommended
    // retired or invented players, so the shortlist is closed now.
    for (const locale of ["en", "es"] as const) {
      const prompt = buildSystemPrompt(withCandidate(locale))
      expect(prompt).toContain(promptCopy(locale).onlyListedPlayers)
      expect(prompt).not.toMatch(/any other league worldwide|cualquier otra liga del mundo/i)
    }
  })

  it("does not close the list when there is no list to close", () => {
    // "¿Quién es el mejor base de la ACB?" is a basketball question. Handing it
    // a closed list it cannot satisfy is how the advisor ended up refusing to
    // name anybody at all.
    for (const locale of ["en", "es"] as const) {
      const prompt = buildSystemPrompt(input(locale, { operation: "general" }))
      expect(prompt).not.toContain(promptCopy(locale).onlyListedPlayers)
      expect(prompt).toContain(promptCopy(locale).knowledgeRule)
    }
  })

  it("keeps the shortlist framing off a question that is not about signing", () => {
    for (const locale of ["en", "es"] as const) {
      const prompt = buildSystemPrompt(
        input(locale, { operation: "general", candidates: withCandidate(locale).candidates }),
      )
      expect(prompt).not.toContain(promptCopy(locale).candidatesHeading)
      expect(prompt).not.toContain(promptCopy(locale).operationHeading)
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
