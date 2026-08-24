// @vitest-environment jsdom
import { createElement } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LocaleProvider } from "@/lib/i18n/provider"
import { es } from "@/lib/i18n/dictionaries/es"
import { en } from "@/lib/i18n/dictionaries/en"
import { AdvisorResponse } from "@/app/ai-advisor/advisor-response"
import type { AdvisorOutput } from "@/lib/ai/local-advisor"

// Framer Motion animates on mount; in jsdom we only care about the content.
vi.mock("framer-motion", () => ({
  motion: new Proxy({} as Record<string, unknown>, {
    get: (_target, tag: string) => {
      const Component = ({
        children,
        ...props
      }: {
        children?: React.ReactNode
        [key: string]: unknown
      }) => {
        const passthrough = Object.fromEntries(
          Object.entries(props).filter(
            ([key]) =>
              !/^(initial|animate|transition|whileHover|exit|variants)$/.test(
                key,
              ),
          ),
        )
        return createElement(tag, passthrough, children)
      }
      return Component
    },
  }),
}))

const DATA: AdvisorOutput = {
  intent: "scorer",
  intentLabel: "Anotador",
  intentEmoji: "🎯",
  team: {
    name: "Unicaja",
    league: "Liga ACB",
    leagueBadge: "ACB",
    rosterSize: 13,
    topPlayers: ["Kalinoski"],
  },
  analysis: "Resumen del hueco detectado.",
  gap: "Falta tiro exterior en el segundo cinco",
  recommendations: [
    {
      name: "Jean Montero",
      position: "PG",
      league: "Liga ACB",
      age: 23,
      contractValue: "1,2 M€",
      annual: "420 K€/año",
      strengths: ["Titular", "Rating 68/100"],
      fit: "14,2 puntos por partido con un 39% en triples",
      market: "Valencia Basket",
      stats: [
        { label: "PTS", value: "14.2" },
        { label: "T3", value: "39%" },
        { label: "PJ", value: "28" },
      ],
      priority: "Prioridad alta",
      priorityColor: "",
    },
  ],
  considerations: ["Revisa el espacio salarial"],
}

function renderEs(props: Partial<{ showAnalysis: boolean }> = {}) {
  return render(
    <LocaleProvider locale="es" dict={es}>
      <AdvisorResponse data={DATA} {...props} />
    </LocaleProvider>,
  )
}

describe("advisor shortlist card", () => {
  it("shows the real season line, not just a price and an adjective", () => {
    renderEs()
    expect(screen.getByText("14.2")).toBeTruthy()
    expect(screen.getByText("39%")).toBeTruthy()
    expect(screen.getByText("1,2 M€")).toBeTruthy()
    expect(screen.getByText(/420 K€\/año/)).toBeTruthy()
    expect(screen.getByText(/14,2 puntos por partido/)).toBeTruthy()
  })

  it("labels every number in the reader's language", () => {
    renderEs()
    expect(screen.getByText("Valor estimado")).toBeTruthy()
    expect(screen.getByText("Por partido")).toBeTruthy()
    expect(screen.getByText("Candidatos recomendados")).toBeTruthy()
    expect(screen.getByText(/Hueco detectado/)).toBeTruthy()
    expect(screen.queryByText("Recommended candidates")).toBeNull()
  })

  it("switches language with the reader", () => {
    render(
      <LocaleProvider locale="en" dict={en}>
        <AdvisorResponse data={DATA} />
      </LocaleProvider>,
    )
    expect(screen.getByText("Recommended candidates")).toBeTruthy()
    expect(screen.getByText("Estimated value")).toBeTruthy()
  })

  it("drops the rule-based summary when a model already answered above", () => {
    renderEs({ showAnalysis: false })
    expect(screen.queryByText("Resumen del hueco detectado.")).toBeNull()
    // The gap and the cards still carry the data the prose does not.
    expect(screen.getByText(/Falta tiro exterior/)).toBeTruthy()
    expect(screen.getByText("Jean Montero")).toBeTruthy()
  })
})
