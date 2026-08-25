// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"
import { AiMarkdown } from "@/components/ai/markdown"

/**
 * The renderer behind every AI answer: the chat, the trade reports, the play
 * breakdowns and the scouting notes. Anything it fails to parse reaches the
 * reader as raw markup, which is the difference between a readable note and a
 * wall of asterisks and hashes.
 */
describe("AiAnalysisDisplay", () => {
  it("renders a bold lead-in without leaking the closing markers", () => {
    const { container } = render(
      <AiAnalysisDisplay text="**En la pista.** Es un base anotador que castiga el uno contra uno." />,
    )
    // The old bug: indexOf("**") matched the OPENING marker, so the label
    // rendered empty and "**" was left sitting mid-sentence.
    expect(container.textContent).not.toContain("**")
    expect(container.querySelector("strong")?.textContent).toBe("En la pista.")
    expect(
      screen.getByText(/Es un base anotador que castiga el uno contra uno/),
    ).toBeInTheDocument()
  })

  it("keeps a bold lead-in inside its paragraph", () => {
    // It is a sentence, not a list row. Promoting it to a bulleted label is
    // what made a plain paragraph look like a form field.
    const { container } = render(
      <AiAnalysisDisplay text="**Where he falls short.** He gives up size at the rim." />,
    )
    const paragraphs = container.querySelectorAll("p")
    expect(paragraphs).toHaveLength(1)
    expect(container.querySelectorAll("li")).toHaveLength(0)
    expect(paragraphs[0].textContent).toBe(
      "Where he falls short. He gives up size at the rim.",
    )
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
    expect(container.querySelector("h2")?.textContent).toBe("Mi recomendación")
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

/**
 * Everything a model actually emits and the old parsers dropped on the floor.
 */
describe("AiMarkdown", () => {
  it("renders every heading level as a heading, hashes included", () => {
    // `####` fell through to the paragraph branch and reached the reader with
    // its hashes attached.
    const { container } = render(
      <AiMarkdown text={"# One\n\n## Two\n\n### Three\n\n#### Four"} />,
    )
    expect(container.textContent).not.toContain("#")
    expect(container.querySelector("h1")?.textContent).toBe("One")
    expect(container.querySelector("h2")?.textContent).toBe("Two")
    expect(container.querySelector("h3")?.textContent).toBe("Three")
    expect(container.querySelector("h4")?.textContent).toBe("Four")
  })

  it("decorates nothing the model did not write", () => {
    // Headings used to get an emoji chip chosen by matching English keywords,
    // so the same answer was decorated in English and bare in Spanish.
    const { container } = render(<AiMarkdown text={"## Verdict\n\nHe fits."} />)
    expect(container.textContent).toBe("VerdictHe fits.")
  })

  it("does not turn a heading into a player card", () => {
    const { container } = render(
      <AiMarkdown text="### Jean Montero — SG, 22, Valencia" />,
    )
    expect(container.querySelector("h3")?.textContent).toBe(
      "Jean Montero — SG, 22, Valencia",
    )
    // The avatar-initials card that used to hijack this shape.
    expect(container.textContent).not.toContain("JM")
  })

  it("renders ordered lists as ordered lists", () => {
    const { container } = render(
      <AiMarkdown text={"1. First move\n2. Second move\n3. Third move"} />,
    )
    expect(container.querySelector("ol")).not.toBeNull()
    expect(container.querySelectorAll("li")).toHaveLength(3)
  })

  it("nests a sub-list under its parent item", () => {
    const { container } = render(
      <AiMarkdown text={"- Wings\n  - Montero\n  - Brown\n- Bigs"} />,
    )
    const top = container.querySelector("ul")
    expect(top?.querySelectorAll(":scope > li")).toHaveLength(2)
    expect(container.querySelectorAll("ul")).toHaveLength(2)
    expect(container.querySelectorAll("li")).toHaveLength(4)
  })

  it("renders tables, quotes, rules and code", () => {
    const { container } = render(
      <AiMarkdown
        text={[
          "| Player | PTS |",
          "| --- | --- |",
          "| Montero | 14.2 |",
          "",
          "> A quoted line.",
          "",
          "---",
          "",
          "```",
          "raw block",
          "```",
        ].join("\n")}
      />,
    )
    expect(container.querySelectorAll("th")).toHaveLength(2)
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(container.querySelector("blockquote")?.textContent).toBe(
      "A quoted line.",
    )
    expect(container.querySelector("hr")).not.toBeNull()
    expect(container.querySelector("pre")?.textContent).toBe("raw block")
    // The separator row is furniture, never a data row.
    expect(container.textContent).not.toContain("---")
  })

  it("joins a soft-wrapped paragraph and separates real ones", () => {
    const { container } = render(
      <AiMarkdown text={"One sentence\nwrapped in two.\n\nA second paragraph."} />,
    )
    const paragraphs = container.querySelectorAll("p")
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].textContent).toBe("One sentence wrapped in two.")
  })

  it("renders links, italics and strikethrough", () => {
    const { container } = render(
      <AiMarkdown text="Per [AS](https://example.com), *maybe* not ~~certain~~." />,
    )
    const link = container.querySelector("a")
    expect(link?.getAttribute("href")).toBe("https://example.com")
    expect(link?.textContent).toBe("AS")
    expect(container.querySelector("em")?.textContent).toBe("maybe")
    expect(container.querySelector("s")?.textContent).toBe("certain")
    expect(container.textContent).not.toContain("~~")
  })
})
