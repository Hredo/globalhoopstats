// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"

/**
 * This renderer shows the player and trade analyses. Anything it fails to
 * parse is shown to the reader as raw markup, which is the difference between
 * a readable note and a wall of asterisks.
 */
describe("AiAnalysisDisplay", () => {
  it("renders a labelled paragraph without leaking the closing markers", () => {
    const { container } = render(
      <AiAnalysisDisplay text="**En la pista.** Es un base anotador que castiga el uno contra uno." />,
    )
    // The bug: indexOf("**") matched the OPENING marker, so the label rendered
    // empty and "**" was left mid-sentence.
    expect(container.textContent).not.toContain("**")
    expect(screen.getByText(/En la pista/)).toBeInTheDocument()
    expect(
      screen.getByText(/Es un base anotador que castiga el uno contra uno/),
    ).toBeInTheDocument()
  })

  it("keeps the label and the body as separate, styled spans", () => {
    const { container } = render(
      <AiAnalysisDisplay text="**Where he falls short.** He gives up size at the rim." />,
    )
    const strongish = container.querySelector(".font-semibold")
    expect(strongish?.textContent).toBe("Where he falls short.")
    expect(container.textContent).toContain("He gives up size at the rim.")
  })

  it("accepts the colon and dash variants the models produce", () => {
    for (const text of [
      "**Value:** about 1.2 million a year.",
      "**Value** — about 1.2 million a year.",
      "**Value.** about 1.2 million a year.",
    ]) {
      const { container, unmount } = render(<AiAnalysisDisplay text={text} />)
      expect(container.textContent, text).not.toContain("**")
      expect(container.textContent, text).toContain("about 1.2 million a year.")
      unmount()
    }
  })

  it("still renders a fully bold line as a sub-heading", () => {
    const { container } = render(<AiAnalysisDisplay text="**Verdict**" />)
    expect(container.textContent).toBe("Verdict")
  })

  it("renders headings, bullets and inline bold without leaking markup", () => {
    const { container } = render(
      <AiAnalysisDisplay
        text={[
          "## Mi recomendación",
          "- **Jean Montero** encaja por creación.",
          "- Alternativa más barata.",
          "",
          "Cierro con una frase de veredicto.",
        ].join("\n")}
      />,
    )
    const text = container.textContent ?? ""
    expect(text).not.toContain("**")
    expect(text).not.toContain("## ")
    expect(text).toContain("Mi recomendación")
    expect(text).toContain("Jean Montero")
    expect(text).toContain("Cierro con una frase de veredicto.")
    expect(container.querySelectorAll("li")).toHaveLength(2)
  })

  it("leaves ordinary prose untouched", () => {
    const prose = "Es el mejor reboteador de la liga (11,2 por partido)."
    const { container } = render(<AiAnalysisDisplay text={prose} />)
    expect(container.textContent).toBe(prose)
  })
})
