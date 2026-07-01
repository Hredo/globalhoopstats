// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TiltCard } from "@/components/ui/tilt-card"

describe("TiltCard", () => {
  it("renders children", () => {
    render(
      <TiltCard>
        <p>Card content</p>
      </TiltCard>,
    )
    expect(screen.getByText("Card content")).toBeInTheDocument()
  })

  it("renders as div by default", () => {
    const { container } = render(<TiltCard>Content</TiltCard>)
    // The inner Tag (div) wraps the content
    expect(container.querySelector(".gh-tilt")).toBeInTheDocument()
  })

  it("forwards className", () => {
    const { container } = render(<TiltCard className="custom-card">Content</TiltCard>)
    expect(container.querySelector(".custom-card")).toBeInTheDocument()
  })

  it("adds gh-glare class when glare is true", () => {
    const { container } = render(<TiltCard glare>Content</TiltCard>)
    expect(container.querySelector(".gh-glare")).toBeInTheDocument()
  })

  it("does not add gh-glare class when glare is false", () => {
    const { container } = render(<TiltCard glare={false}>Content</TiltCard>)
    expect(container.querySelector(".gh-glare")).toBeNull()
  })
})
