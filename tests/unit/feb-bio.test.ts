import { describe, it, expect } from "vitest"
import { missingBio } from "@/lib/sources/feb"

describe("FEB bio completeness", () => {
  const full = {
    position: "Base",
    heightCm: 172,
    weightKg: 64,
    nationality: "España",
    birthdate: "2001-03-12",
  }

  it("is complete only with every field FEB publishes", () => {
    expect(missingBio(full)).toBe(false)
  })

  it("ignores weight, which FEB never publishes for women", () => {
    expect(missingBio({ ...full, weightKg: undefined })).toBe(false)
  })

  it.each(["position", "heightCm", "nationality", "birthdate"])(
    "flags a player missing %s",
    (key) => {
      expect(missingBio({ ...full, [key]: undefined })).toBe(true)
    },
  )
})
