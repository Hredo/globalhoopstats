import { beforeAll, describe, expect, it } from "vitest"
import {
  MEN_LEAGUE_SLUGS,
  WOMEN_LEAGUE_SLUGS,
  genderForLeagueSlug,
  genderParam,
  parseGender,
  teamSlugFor,
} from "@/lib/gender"
import {
  LEAGUE_FILTER_VALUES,
  genderForFilter,
  leagueFilterTree,
  leagueSlugsFor,
  scopeLeague,
} from "@/lib/league-groups"
import { tierForName, tierForSlug, tiersConflict } from "@/lib/leagues-tier"
import { EntityMatcher } from "@/lib/sync/entity-matcher"
import {
  LEAGUE_ECONOMICS,
  adjacentLeagueSlugs,
  sameGenderLeagues,
} from "@/lib/market/league-strength"
import { detectLeagueSlug } from "@/lib/market/team-profiles"
import { NEXT_LEVEL, PROJECTABLE_LEAGUES } from "@/lib/scouting/projection"
import { SOURCE_IDS } from "@/lib/sources"
import {
  CURRENT_SEASON,
  SOURCE_META,
  finalPhaseSeason,
} from "@/lib/sources/types"
import { FEB_CONFIGS, FEB_WOMEN_CONFIGS } from "@/lib/sources/feb"
import { genderDirective } from "@/lib/ai/prompt-copy"
import { isInSeason } from "@/lib/sync/season-window"

// Same deterministic (no-LLM) matcher configuration as entity-matcher-tier.
beforeAll(() => {
  process.env.OLLAMA_BASE_URL = "http://example.com"
})

describe("league gender", () => {
  it("classifies every source as exactly one side", () => {
    const known = new Set<string>([...MEN_LEAGUE_SLUGS, ...WOMEN_LEAGUE_SLUGS])
    // A source added without a gender would silently fall on the men's side
    // AND vanish from every listing; fail here instead.
    for (const id of SOURCE_IDS) expect(known.has(id)).toBe(true)
    expect(known.size).toBe(SOURCE_IDS.length)
    for (const slug of WOMEN_LEAGUE_SLUGS) {
      expect(genderForLeagueSlug(slug)).toBe("women")
    }
    for (const slug of MEN_LEAGUE_SLUGS) {
      expect(genderForLeagueSlug(slug)).toBe("men")
    }
    expect(genderForLeagueSlug(null)).toBe("men")
  })

  it("scrapes the three women's competitions from their own FEB ids", () => {
    expect(FEB_WOMEN_CONFIGS.map((c) => c.id)).toEqual([...WOMEN_LEAGUE_SLUGS])
    const ids = [...FEB_CONFIGS, ...FEB_WOMEN_CONFIGS].map((c) => c.g)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of FEB_WOMEN_CONFIGS) {
      expect(SOURCE_META[c.id].displayName).toBe(c.displayName)
      expect(isInSeason(c.id, new Date("2026-07-15"))).toBe(false)
    }
    expect(isInSeason("lf2", new Date("2026-11-15"))).toBe(true)
  })

  it("reads Primera Nacional Femenina from its June final phase", () => {
    const pnf = FEB_WOMEN_CONFIGS.find(
      (c) => c.id === "primera-nacional-femenina",
    )!
    // No regular season exists as one feed: only the final-phase groups.
    expect(pnf.groupPattern!.test("FASE FINAL-A FFA1")).toBe(true)
    expect(pnf.groupPattern!.test("2ºGR3-2ºGR4 2ºGR3-2ºGR4")).toBe(false)
    expect(pnf.groupPattern!.test("Liga Regular Único")).toBe(false)
    // Scheduled runs only touch it the month it is played.
    expect(isInSeason(pnf.id, new Date("2027-06-10"))).toBe(true)
    expect(isInSeason(pnf.id, new Date("2026-11-15"))).toBe(false)
    // The edition of season Y appears in June of Y+1; before that the newest
    // one is the previous season's, and it never runs ahead of the site.
    expect(finalPhaseSeason(new Date("2026-11-11"))).toBe(2025)
    expect(finalPhaseSeason(new Date("2026-05-31"))).toBe(2024)
    expect(finalPhaseSeason(new Date("2026-06-01"))).toBe(2025)
    expect(finalPhaseSeason(new Date("2030-06-01"))).toBe(CURRENT_SEASON)
  })

  it("keeps the query-string value clean for the default side", () => {
    expect(parseGender("women")).toBe("women")
    expect(parseGender("anything")).toBe("men")
    expect(parseGender(undefined)).toBe("men")
    expect(genderParam("men")).toBeUndefined()
    expect(genderParam("women")).toBe("women")
  })

  it("gives a women's team its own slug even with the men's exact name", () => {
    expect(teamSlugFor("valencia-basket", "men")).toBe("valencia-basket")
    expect(teamSlugFor("valencia-basket", "women")).toBe(
      "valencia-basket-femenino",
    )
    expect(teamSlugFor("valencia-basket-femenino", "women")).toBe(
      "valencia-basket-femenino",
    )
  })
})

describe("league filters never mix the two sides", () => {
  it("treats an empty filter as the men's leagues, not as everything", () => {
    expect(leagueSlugsFor(undefined)).toEqual([...MEN_LEAGUE_SLUGS])
    expect(leagueSlugsFor("")).toEqual([...MEN_LEAGUE_SLUGS])
    expect(leagueSlugsFor("men")).toEqual([...MEN_LEAGUE_SLUGS])
    expect(leagueSlugsFor("women")).toEqual([...WOMEN_LEAGUE_SLUGS])
    expect(leagueSlugsFor("feb")).toEqual(["leb-oro", "leb-plata", "eba"])
    expect(leagueSlugsFor("lf2")).toEqual(["lf2"])
    expect(leagueSlugsFor("all")).toBeNull()
  })

  it("scopes a query to the picked league, else to the whole gender", () => {
    expect(scopeLeague(undefined, "women")).toBe("women")
    expect(scopeLeague(undefined, "men")).toBe("men")
    expect(scopeLeague("acb", "women")).toBe("acb")
    expect(genderForFilter("women")).toBe("women")
    expect(genderForFilter("lf-challenge")).toBe("women")
    expect(genderForFilter("feb")).toBe("men")
    for (const slug of [...WOMEN_LEAGUE_SLUGS, "women", "men", "feb"]) {
      expect(LEAGUE_FILTER_VALUES.has(slug)).toBe(true)
    }
  })

  it("offers each side only its own leagues in the filter menu", () => {
    const flat = (g: "men" | "women") =>
      leagueFilterTree(g).flatMap((n) => [n, ...(n.children ?? [])])
    for (const node of flat("women")) {
      expect(genderForFilter(node.slug)).toBe("women")
    }
    for (const node of flat("men")) {
      expect(genderForFilter(node.slug)).toBe("men")
    }
  })
})

describe("identity resolution across genders", () => {
  it("puts the women's leagues in their own tier", () => {
    expect(tierForSlug("lf-endesa")).toBe("women")
    expect(tierForSlug("lf2")).toBe("women")
    expect(tierForName("Liga Femenina Endesa")).toBe("women")
    expect(tierForName("Liga Femenina Challenge")).toBe("women")
    // The ACB's sponsor name must not be caught by the women's one.
    expect(tierForName("Liga Endesa")).toBe("top")
  })

  it("conflicts with every men's tier and with none of its own", () => {
    expect(tiersConflict(["women"], ["top"])).toBe(true)
    expect(tiersConflict(["feb"], ["women"])).toBe(true)
    expect(tiersConflict(["women"], ["women"])).toBe(false)
    expect(tiersConflict(["top"], ["top"])).toBe(false)
  })

  it("never fuses a woman into a man who shares her name", async () => {
    const matcher = new EntityMatcher([
      {
        id: "man-1",
        fullName: "Andrea Vilaró",
        nationality: "España",
        position: "G",
        heightCm: 190,
        tiers: ["top"],
      },
    ])
    const decision = await matcher.resolve({
      fullName: "Andrea Vilaró",
      league: "Liga Femenina Endesa",
      nationality: "España",
    })
    expect(decision).toEqual({ kind: "new" })
  })

  it("keeps one record for a woman who moves between women's leagues", async () => {
    const matcher = new EntityMatcher([
      {
        id: "woman-1",
        fullName: "Laura Quevedo",
        nationality: "España",
        position: "F",
        heightCm: 184,
        tiers: ["women"],
      },
    ])
    const decision = await matcher.resolve({
      fullName: "Laura Quevedo",
      league: "Liga Femenina Challenge",
    })
    expect(decision).toEqual({ kind: "existing", playerId: "woman-1" })
  })
})

describe("market, projection and AI stay on one side", () => {
  it("builds the market universe from same-gender leagues only", () => {
    for (const slug of Object.keys(LEAGUE_ECONOMICS)) {
      for (const adjacent of adjacentLeagueSlugs(slug)) {
        expect(genderForLeagueSlug(adjacent)).toBe(genderForLeagueSlug(slug))
      }
    }
    expect(adjacentLeagueSlugs("lf-endesa")).toEqual([
      "lf-endesa",
      "lf-challenge",
    ])
    // Same tier number as Liga Femenina Endesa, different world.
    expect(adjacentLeagueSlugs("acb")).not.toContain("lf-endesa")
    for (const slug of WOMEN_LEAGUE_SLUGS) {
      expect(LEAGUE_ECONOMICS[slug]).toBeDefined()
    }
  })

  it("drops requested leagues from the other side", () => {
    expect(
      sameGenderLeagues(["acb", "lf-endesa", "lf2"], "lf-challenge"),
    ).toEqual(["lf-endesa", "lf2"])
    expect(sameGenderLeagues(["acb", "lf-endesa"], "eba")).toEqual(["acb"])
    expect(sameGenderLeagues(["acb"], "lf2")).toEqual([])
  })

  it("projects along the women's ladder without leaving it", () => {
    expect(NEXT_LEVEL["primera-nacional-femenina"]).toBe("lf2")
    expect(NEXT_LEVEL.lf2).toBe("lf-challenge")
    expect(NEXT_LEVEL["lf-challenge"]).toBe("lf-endesa")
    for (const [from, to] of Object.entries(NEXT_LEVEL)) {
      if (to) expect(genderForLeagueSlug(to)).toBe(genderForLeagueSlug(from))
    }
    for (const slug of WOMEN_LEAGUE_SLUGS) {
      expect(PROJECTABLE_LEAGUES).toContain(slug)
    }
  })

  it("reads a women's league in a question as that league, not the ACB", () => {
    expect(detectLeagueSlug("fichajes para la Liga Femenina Endesa")).toBe(
      "lf-endesa",
    )
    expect(detectLeagueSlug("una base para Liga Femenina Challenge")).toBe(
      "lf-challenge",
    )
    expect(detectLeagueSlug("equipos de Liga Femenina 2")).toBe("lf2")
    expect(detectLeagueSlug("un pívot para la Liga Endesa")).toBe("acb")
  })

  it("tells the model which side it is writing about, in both languages", () => {
    for (const locale of ["es", "en"] as const) {
      const women = genderDirective("women", locale)
      const men = genderDirective("men", locale)
      expect(women).toContain("Liga Femenina Endesa")
      expect(women).not.toBe(men)
      expect(men.length).toBeGreaterThan(20)
    }
    expect(genderDirective("women", "es")).toMatch(/femenino/i)
    expect(genderDirective("women", "en")).toMatch(/women/i)
  })
})
