// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SeasonSelect } from "@/components/ui/season-select"
import type { ClientTranslator } from "@/lib/i18n/provider"

/**
 * Stand-in for the dictionary lookup. Mirrors the real interpolation so the
 * assertions below check the label the visitor actually reads.
 */
const t = ((key: string, vars?: Record<string, string | number>) => {
  if (key === "directory.seasonCurrent") return `${vars?.season} · current`
  if (key === "directory.seasonPrefix") return `Season ${vars?.season}`
  if (key === "directory.filterBySeason") return "Filter by season"
  return key
}) as unknown as ClientTranslator

const SEASONS = ["2026-27", "2025-26", "2024-25"]

describe("SeasonSelect", () => {
  it("lists every season, newest first", () => {
    render(
      <SeasonSelect
        seasons={SEASONS}
        value="2026-27"
        onChange={() => {}}
        t={t}
      />,
    )
    const options = screen.getAllByRole("option")
    expect(options.map((o) => o.getAttribute("value"))).toEqual(SEASONS)
  })

  it("marks the newest season as the current one", () => {
    render(
      <SeasonSelect
        seasons={SEASONS}
        value="2026-27"
        onChange={() => {}}
        t={t}
      />,
    )
    expect(screen.getByText("2026-27 · current")).toBeInTheDocument()
    expect(screen.getByText("Season 2025-26")).toBeInTheDocument()
  })

  it("shows the season being viewed, not always the newest", () => {
    render(
      <SeasonSelect
        seasons={SEASONS}
        value="2024-25"
        onChange={() => {}}
        t={t}
      />,
    )
    expect(screen.getByRole("combobox")).toHaveValue("2024-25")
  })

  it("reports the season the visitor picked", async () => {
    const onChange = vi.fn()
    render(
      <SeasonSelect
        seasons={SEASONS}
        value="2026-27"
        onChange={onChange}
        t={t}
      />,
    )
    await userEvent.selectOptions(screen.getByRole("combobox"), "2025-26")
    expect(onChange).toHaveBeenCalledWith("2025-26")
  })

  it("renders nothing when there is only one season to choose from", () => {
    // A dropdown that cannot change anything is a dead control in the filter
    // bar — and on a fresh database there IS only one season.
    const { container } = render(
      <SeasonSelect
        seasons={["2026-27"]}
        value="2026-27"
        onChange={() => {}}
        t={t}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the season list could not be loaded", () => {
    const { container } = render(
      <SeasonSelect seasons={[]} value="" onChange={() => {}} t={t} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("is labelled for screen readers", () => {
    render(
      <SeasonSelect
        seasons={SEASONS}
        value="2026-27"
        onChange={() => {}}
        t={t}
      />,
    )
    expect(
      screen.getByRole("combobox", { name: "Filter by season" }),
    ).toBeInTheDocument()
  })
})
