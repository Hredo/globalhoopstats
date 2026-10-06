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

  it("blocks targets the URL parser rewrites into another origin", () => {
    // The parser deletes tab/CR/LF anywhere, turning these into //evil.com.
    expect(safeNextPath("/\t/evil.com")).toBe("/ai-advisor")
    expect(safeNextPath("/\n/evil.com")).toBe("/ai-advisor")
    expect(safeNextPath("/\r\n/evil.com")).toBe("/ai-advisor")
    expect(safeNextPath("/%09/evil.com")).toBe("/%09/evil.com")
    expect(safeNextPath("/\u0000/evil.com")).toBe("/ai-advisor")
  })

  it("never hands back anything that leaves the origin", () => {
    for (const raw of ["/\t\\evil.com", "/ /evil.com", "/../..//evil.com"]) {
      const out = safeNextPath(raw)
      expect(new URL(out, "https://globalhoopstats.es").origin).toBe(
        "https://globalhoopstats.es",
      )
    }
  })
})
