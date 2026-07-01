// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SectionHeading } from "@/components/ui/section-heading"

describe("SectionHeading", () => {
  it("renders title", () => {
    render(<SectionHeading title="Hello" />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hello")
  })

  it("renders eyebrow when provided", () => {
    render(<SectionHeading eyebrow="Eyebrow" title="Title" />)
    expect(screen.getByText("Eyebrow")).toBeInTheDocument()
  })

  it("does not render eyebrow when not provided", () => {
    const { container } = render(<SectionHeading title="Title" />)
    expect(container.querySelector("span")?.textContent).not.toBe("Eyebrow")
  })

  it("renders description when provided", () => {
    render(<SectionHeading title="Title" description="Description text" />)
    expect(screen.getByText("Description text")).toBeInTheDocument()
  })

  it("does not render description when not provided", () => {
    const { container } = render(<SectionHeading title="Title" />)
    expect(container.querySelector("p")).toBeNull()
  })

  it("applies center alignment classes", () => {
    const { container } = render(<SectionHeading title="Title" align="center" />)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain("text-center")
  })

  it("applies custom className to wrapper", () => {
    const { container } = render(<SectionHeading title="Title" className="custom-class" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain("custom-class")
  })

  it("renders eyebrow as ReactNode", () => {
    render(<SectionHeading eyebrow={<span data-testid="custom">Custom</span>} title="Title" />)
    expect(screen.getByTestId("custom")).toBeInTheDocument()
  })
})
