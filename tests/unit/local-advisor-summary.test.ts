import { describe, it, expect } from "vitest"
import { buildFallbackSummary, type Recruit } from "@/lib/ai/local-advisor"

/**
 * The rule-based advisor is what people see when they have not connected a
 * model, so its one summary sentence has to earn its place. Tested directly
 * rather than through buildLocalAdvice, which reaches the database.
 */
const CANDIDATES: Recruit[] = [
  {
    name: "Jean Montero",
    position: "PG",
    league: "Liga ACB",
    age: 23,
    contractValue: "€1,2 M",
    strengths: ["Creación"],
    fit: "Encaja como base titular",
    market: "Valencia Basket",
  },
  {
    name: "Segundo Jugador",
    position: "SG",
    league: "Primera FEB",
    age: 25,
    contractValue: "€400 K",
    strengths: ["Tiro"],
    fit: "Rotación",
    market: "Agente libre",
  },
]

const GAP_ES = "Refuerzos en el backcourt (bases y escoltas)"
const GAP_EN = "Backcourt reinforcements (point guards and shooting guards)"

describe("rule-based advisor summary", () => {
  it("names the roster gap, the shortlist size and the first candidate", () => {
    const out = buildFallbackSummary({
      label: "Base anotador",
      gap: GAP_ES,
      recs: CANDIDATES,
      rosterSize: 12,
      locale: "es",
    })
    expect(out).toContain("Jean Montero")
    expect(out).toContain("€1,2 M")
    expect(out).toContain("12")
    expect(out.toLowerCase()).toContain("backcourt")
  })

  it("dropped the sentence that was true of every signing ever made", () => {
    for (const [locale, gap] of [
      ["es", GAP_ES],
      ["en", GAP_EN],
    ] as const) {
      const out = buildFallbackSummary({
        label: "Scoring guard",
        gap,
        recs: CANDIDATES,
        rosterSize: 10,
        locale,
      })
      expect(out).not.toMatch(/perfil diferencial/i)
      expect(out).not.toMatch(/differential profile/i)
      expect(out).not.toMatch(/podría aportar/i)
    }
  })

  it("admits it found nothing rather than inventing a recommendation", () => {
    const out = buildFallbackSummary({
      label: "Pívot",
      gap: GAP_ES,
      recs: [],
      rosterSize: 12,
      locale: "es",
    })
    expect(out).toMatch(/no hemos encontrado/i)
    expect(out).not.toContain("undefined")
  })

  it("writes in the requested language", () => {
    const es = buildFallbackSummary({
      label: "Base",
      gap: GAP_ES,
      recs: CANDIDATES,
      rosterSize: 12,
      locale: "es",
    })
    const en = buildFallbackSummary({
      label: "Guard",
      gap: GAP_EN,
      recs: CANDIDATES,
      rosterSize: 12,
      locale: "en",
    })
    expect(es).toMatch(/plantilla|hueco|encajan/i)
    expect(en).toMatch(/roster|hole|options/i)
    expect(en).not.toMatch(/plantilla/i)
  })

  it("never leaves a raw placeholder in the sentence", () => {
    const out = buildFallbackSummary({
      label: "Alero",
      gap: GAP_ES,
      recs: [CANDIDATES[0]],
      rosterSize: 1,
      locale: "es",
    })
    expect(out).not.toContain("undefined")
    expect(out).not.toContain("NaN")
    expect(out).not.toContain("[object")
  })
})
