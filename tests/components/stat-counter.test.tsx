// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatCounter } from "@/components/ui/stat-counter"

describe("StatCounter", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => {
      cb(performance.now() + 9999)
      return 1
    }))
    vi.stubGlobal("IntersectionObserver", vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders the DOM structure", () => {
    const { container } = render(<StatCounter to={42} />)
    expect(container.querySelector(".nums")).toBeInTheDocument()
    expect(container.querySelector(".tabular-nums")).toBeInTheDocument()
  })

  it("renders with prefix and suffix", () => {
    const { container } = render(<StatCounter to={42} prefix="$" suffix="M" />)
    const span = container.querySelector(".nums")
    expect(span).toBeInTheDocument()
    expect(span?.textContent).toBe("$0M")
  })

  it("renders with custom className", () => {
    const { container } = render(<StatCounter to={5} className="text-lg" />)
    expect(container.querySelector(".text-lg")).toBeInTheDocument()
  })

  it("snaps to final value when prefers-reduced-motion", () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    vi.stubGlobal("matchMedia", matchMediaMock)

    render(<StatCounter to={99} />)
    expect(screen.getByText("99")).toBeInTheDocument()
  })
})
