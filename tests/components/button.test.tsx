// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button, ButtonLink } from "@/components/ui/button"

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument()
  })

  it("renders with arrow icon when arrow prop is true", () => {
    const { container } = render(<Button arrow>Next</Button>)
    const btn = screen.getByRole("button")
    expect(btn).toContainHTML("svg")
  })

  it("applies variant class for primary", () => {
    render(<Button variant="primary">Primary</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("bg-brand-500")
  })

  it("applies variant class for secondary", () => {
    render(<Button variant="secondary">Secondary</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("border-hairline")
  })

  it("applies variant class for ghost", () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("text-ink-200")
  })

  it("applies size class for sm", () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("h-9")
  })

  it("applies size class for lg", () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("h-12")
  })

  it("disables the button", () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("fires onClick handler", async () => {
    const user = userEvent.setup()
    let clicked = false
    render(<Button onClick={() => { clicked = true }}>Click</Button>)
    await user.click(screen.getByRole("button"))
    expect(clicked).toBe(true)
  })

  it("forwards additional className", () => {
    render(<Button className="extra-class">Styled</Button>)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("extra-class")
  })

  it("renders with custom aria-label", () => {
    render(<Button aria-label="custom label">Btn</Button>)
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "custom label")
  })
})

describe("ButtonLink", () => {
  it("renders as a link with href", () => {
    render(<ButtonLink href="/test">Link</ButtonLink>)
    const link = screen.getByRole("link", { name: /link/i })
    expect(link).toHaveAttribute("href", "/test")
  })

  it("renders with arrow icon", () => {
    const { container } = render(<ButtonLink href="/" arrow>Go</ButtonLink>)
    const link = screen.getByRole("link")
    expect(link).toContainHTML("svg")
  })

  it("applies variant classes", () => {
    render(<ButtonLink href="/" variant="secondary">Sec</ButtonLink>)
    const link = screen.getByRole("link")
    expect(link.className).toContain("border-hairline")
  })
})
