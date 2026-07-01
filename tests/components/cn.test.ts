// @vitest-environment node
import { describe, it, expect } from "vitest"
import { cn } from "@/components/ui/cn"

describe("cn", () => {
  it("joins truthy strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c")
  })

  it("filters out false, null, undefined", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b")
  })

  it("returns empty string for no truthy values", () => {
    expect(cn(false, null, undefined)).toBe("")
  })

  it("returns empty string for no args", () => {
    expect(cn()).toBe("")
  })
})
