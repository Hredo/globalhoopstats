import { describe, it, expect } from "vitest"
import { safeNextPath } from "@/lib/auth/safe-redirect"

describe("safeNextPath (open-redirect guard)", () => {
  it("allows same-site absolute paths", () => {
    expect(safeNextPath("/account")).toBe("/account")
    expect(safeNextPath("/players/luka-doncic?tab=stats")).toBe(
      "/players/luka-doncic?tab=stats",
    )
  })

  it("falls back for empty / missing input", () => {
    expect(safeNextPath(null)).toBe("/ai-advisor")
    expect(safeNextPath(undefined)).toBe("/ai-advisor")
    expect(safeNextPath("")).toBe("/ai-advisor")
    expect(safeNextPath("/x", "/custom-fallback")).toBe("/x")
  })

  it("blocks protocol-relative and backslash open-redirect tricks", () => {
    expect(safeNextPath("//evil.com")).toBe("/ai-advisor")
    expect(safeNextPath("/\\evil.com")).toBe("/ai-advisor")
    expect(safeNextPath("https://evil.com")).toBe("/ai-advisor")
    expect(safeNextPath("javascript:alert(1)")).toBe("/ai-advisor")
    expect(safeNextPath("relative/path")).toBe("/ai-advisor")
  })
})
