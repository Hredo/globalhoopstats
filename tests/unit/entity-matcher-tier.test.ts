import { beforeAll, describe, expect, it } from "vitest"
import { EntityMatcher } from "@/lib/sync/entity-matcher"
import { tiersConflict, tierForSlug, tierForName } from "@/lib/leagues-tier"

// Force the deterministic (no-LLM) path: a non-allowlisted host makes
// safeOllamaBaseUrl return null, so the matcher uses exact-name + heuristic
// only. This is the configuration the owner now runs (Ollama removed).
beforeAll(() => {
  process.env.OLLAMA_BASE_URL = "http://example.com"
})

describe("leagues-tier helpers", () => {
  it("classifies FEB feeder divisions vs top tier", () => {
    expect(tierForSlug("eba")).toBe("feb")
    expect(tierForSlug("leb-oro")).toBe("feb")
    expect(tierForSlug("leb-plata")).toBe("feb")
    expect(tierForSlug("acb")).toBe("top")
    expect(tierForSlug("euroleague")).toBe("top")
    expect(tierForSlug("nba")).toBe("top")
    expect(tierForName("Liga EBA")).toBe("feb")
    expect(tierForName("Liga Endesa")).toBe("top") // ACB display name
  })

  it("flags only FEB↔top combinations as conflicting", () => {
    expect(tiersConflict(["feb"], ["top"])).toBe(true)
    expect(tiersConflict(["top"], ["feb"])).toBe(true)
    expect(tiersConflict(["top"], ["top"])).toBe(false) // ACB + EuroLeague
    expect(tiersConflict(["feb"], ["feb"])).toBe(false) // EBA + LEB
  })
})

describe("EntityMatcher FEB↔top guard", () => {
  it("does NOT fuse an EBA namesake into an ACB professional with the same name", async () => {
    const matcher = new EntityMatcher([
      {
        id: "pro-1",
        fullName: "Daniel García",
        nationality: "España",
        position: "G",
        heightCm: 185,
        tiers: ["top"], // already plays ACB
      },
    ])
    // Incoming EBA "Daniel García" (different person, amateur namesake).
    const decision = await matcher.resolve({
      fullName: "Daniel García",
      league: "Liga EBA",
      nationality: "España",
    })
    expect(decision).toEqual({ kind: "new" })
  })

  it("still reuses the same professional across top-tier leagues", async () => {
    const matcher = new EntityMatcher([
      { id: "pro-1", fullName: "Edy Tavares", nationality: "Cabo Verde", position: "C", heightCm: 221, tiers: ["top"] },
    ])
    // ACB player appears again in EuroLeague — must be the same record.
    const decision = await matcher.resolve({
      fullName: "Edy Tavares",
      league: "EuroLeague",
    })
    expect(decision).toEqual({ kind: "existing", playerId: "pro-1" })
  })

  it("reuses an existing FEB namesake when another FEB league sees the same name", async () => {
    const matcher = new EntityMatcher([
      { id: "pro-1", fullName: "Daniel García", nationality: "España", heightCm: 185, position: "G", tiers: ["top"] },
      { id: "feb-1", fullName: "Daniel García", nationality: null, heightCm: null, position: null, tiers: ["feb"] },
    ])
    const decision = await matcher.resolve({
      fullName: "Daniel García",
      league: "LEB Plata",
    })
    // Must land on the FEB namesake, never the ACB professional.
    expect(decision).toEqual({ kind: "existing", playerId: "feb-1" })
  })

  it("keeps a newly-registered FEB player separate from a same-name pro", async () => {
    const matcher = new EntityMatcher([
      { id: "pro-1", fullName: "Lucas Sánchez", nationality: "España", heightCm: 192, position: "F", tiers: ["top"] },
    ])
    // FEB job mints the namesake mid-run.
    matcher.register(
      { id: "feb-1", fullName: "Lucas Sánchez", nationality: null, position: null, heightCm: null },
      "feb",
    )
    const febAgain = await matcher.resolve({ fullName: "Lucas Sánchez", league: "Liga EBA" })
    expect(febAgain).toEqual({ kind: "existing", playerId: "feb-1" })
    const proAgain = await matcher.resolve({ fullName: "Lucas Sánchez", league: "Liga Endesa" })
    expect(proAgain).toEqual({ kind: "existing", playerId: "pro-1" })
  })
})
