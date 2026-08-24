import { describe, it, expect, vi, beforeEach } from "vitest"
import type { MarketPlayer } from "@/lib/market/pool"
import {
  detectMessageLocale,
  replyLocale,
  aiLanguageDirective,
} from "@/lib/ai/language"

/**
 * The pool is the only thing these modules touch that needs a database, so it
 * is the only thing mocked. The maths on top of it is what we are testing.
 */
const getMarketPool = vi.fn<(slugs: string[], minGames?: number) => Promise<MarketPlayer[]>>()
vi.mock("@/lib/market/pool", () => ({
  getMarketPool: (slugs: string[], minGames?: number) =>
    getMarketPool(slugs, minGames),
}))

const { playerLeagueContext, describeLeagueContext } = await import(
  "@/lib/market/player-context"
)
const { leagueTeamProfiles, describeTeamProfiles, detectLeagueSlug } =
  await import("@/lib/market/team-profiles")

type Overrides = {
  name?: string
  team?: string
  points?: number
  rebounds?: number
  assists?: number
  threePct?: number | null
  threeAttempted?: number | null
  rating?: number
  heightCm?: number | null
  games?: number
}

function player(o: Overrides = {}): MarketPlayer {
  const games = o.games ?? 20
  return {
    id: o.name ?? "id",
    slug: (o.name ?? "player").toLowerCase().replace(/\s+/g, "-"),
    fullName: o.name ?? "Player",
    position: "SG",
    nationality: "ES",
    age: 26,
    heightCm: o.heightCm === undefined ? 196 : o.heightCm,
    imageUrl: null,
    league: { slug: "acb", name: "Liga ACB", region: "EU" },
    team: { id: o.team ?? "t", slug: "t", name: o.team ?? "Club", logoUrl: null },
    stats: {
      gamesPlayed: games,
      minutesTotal: games * 25,
      pointsTotal: (o.points ?? 10) * games,
      reboundsTotal: (o.rebounds ?? 4) * games,
      assistsTotal: (o.assists ?? 2) * games,
      stealsTotal: games,
      blocksTotal: games,
      fgPct: 0.45,
      threePct: o.threePct === undefined ? 0.35 : o.threePct,
      ftPct: 0.8,
      threeMade: 40,
      threeAttempted: o.threeAttempted === undefined ? 100 : o.threeAttempted,
      per: 15,
      trueShootingPct: 0.55,
      winShares: 3,
      bpm: 1,
    },
    valuation: {
      eur: 500_000,
      annualEur: 180_000,
      tier: "rotation",
      rating: o.rating ?? 50,
      confidence: "medium",
      leagueSlug: "acb",
    } as MarketPlayer["valuation"],
  }
}

beforeEach(() => {
  getMarketPool.mockReset()
})

describe("playerLeagueContext", () => {
  it("ranks a player against the rest of his league", async () => {
    const star = player({ name: "Star", points: 20, rating: 80 })
    const rest = Array.from({ length: 9 }, (_, i) =>
      player({ name: `P${i}`, points: 5 + i, rating: 40 + i }),
    )
    getMarketPool.mockResolvedValue([star, ...rest])

    const ctx = await playerLeagueContext(star)
    const points = ctx?.ranks.find((r) => r.key === "points")
    expect(points?.value).toBe(20)
    expect(points?.rank).toBe(1)
    expect(points?.percentile).toBe(90) // beats 9 of the 10 measured
    expect(points?.leagueAvg).toBeCloseTo((20 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13) / 10, 5)
  })

  it("ignores three-point percentage on a handful of attempts", async () => {
    // 3-for-6 is not a 50% shooter, and must not be ranked as one.
    const chucker = player({ name: "Chucker", threePct: 0.5, threeAttempted: 6 })
    getMarketPool.mockResolvedValue([
      chucker,
      ...Array.from({ length: 9 }, (_, i) => player({ name: `P${i}` })),
    ])

    const ctx = await playerLeagueContext(chucker)
    expect(ctx?.ranks.some((r) => r.key === "threePct")).toBe(false)
  })

  it("says nothing rather than ranking against a league we barely measured", async () => {
    const p = player()
    getMarketPool.mockResolvedValue([p, player({ name: "Other" })])
    expect(await playerLeagueContext(p)).toBeNull()
  })

  it("skips a player with no real sample this season", async () => {
    const p = player({ games: 2 })
    expect(await playerLeagueContext(p)).toBeNull()
    expect(getMarketPool).not.toHaveBeenCalled()
  })
})

describe("describeLeagueContext", () => {
  it("puts the league average next to every number, in the reader's language", async () => {
    const star = player({ name: "Star", points: 20 })
    getMarketPool.mockResolvedValue([
      star,
      ...Array.from({ length: 9 }, (_, i) => player({ name: `P${i}`, points: 8 })),
    ])
    const ctx = await playerLeagueContext(star)

    const es = describeLeagueContext(ctx, "es")
    expect(es).toContain("media de la liga")
    expect(es).toContain("Puntos por partido: 20.0")
    expect(es).toMatch(/mejor que el \d+%/)

    const en = describeLeagueContext(ctx, "en")
    expect(en).toContain("league average")
    expect(en).not.toContain("media de la liga")
  })

  it("returns nothing when there is no context, so the prompt drops the block", () => {
    expect(describeLeagueContext(null, "es")).toBe("")
  })
})

describe("leagueTeamProfiles", () => {
  it("counts shooters and bigs per club from real season lines", async () => {
    getMarketPool.mockResolvedValue([
      player({ name: "Sniper", team: "Unicaja", threePct: 0.41 }),
      player({ name: "Wing", team: "Unicaja", threePct: 0.36 }),
      player({ name: "Brick", team: "Unicaja", threePct: 0.24 }),
      player({ name: "Tower", team: "Unicaja", threePct: 0.1, heightCm: 212 }),
      player({ name: "Guard", team: "Joventut", threePct: 0.2, points: 18 }),
    ])

    const profiles = await leagueTeamProfiles("acb")
    const unicaja = profiles.find((p) => p.name === "Unicaja")
    expect(unicaja?.players).toBe(4)
    expect(unicaja?.shooters).toBe(2)
    expect(unicaja?.bestShooter?.name).toBe("Sniper")
    expect(unicaja?.bigs).toBe(1)

    const joventut = profiles.find((p) => p.name === "Joventut")
    expect(joventut?.topScorer?.name).toBe("Guard")
    expect(joventut?.shooters).toBe(0)
  })

  it("renders one line per club and forbids naming clubs off the list", async () => {
    getMarketPool.mockResolvedValue([
      player({ name: "A", team: "Unicaja" }),
      player({ name: "B", team: "Joventut" }),
    ])
    const block = describeTeamProfiles(
      await leagueTeamProfiles("acb"),
      "acb",
      "es",
    )
    expect(block).toContain("Liga ACB")
    expect(block).toContain("- Unicaja:")
    expect(block).toContain("- Joventut:")
    expect(block).toMatch(/No menciones clubes que no estén en la lista/)
  })

  it("is empty when we have no squads, so the prompt says nothing about clubs", () => {
    expect(describeTeamProfiles([], "acb", "es")).toBe("")
  })
})

describe("detectLeagueSlug", () => {
  it("finds the league the coach asked about", () => {
    expect(detectLeagueSlug("con que equipo de la ACB funcionaria")).toBe("acb")
    expect(detectLeagueSlug("which EuroLeague side runs this?")).toBe(
      "euroleague",
    )
    expect(detectLeagueSlug("un equipo de Primera FEB")).toBe("leb-oro")
    expect(detectLeagueSlug("¿es una buena jugada?")).toBeNull()
  })
})

describe("answering in the language of the question", () => {
  it("follows the coach, not the site setting", () => {
    expect(detectMessageLocale("con que equipo de la acb funcionaria esta jugada")).toBe("es")
    expect(detectMessageLocale("which team could run this play for me")).toBe("en")
    // An English page with a Spanish question still gets a Spanish answer.
    expect(replyLocale("necesito un base organizador para el equipo", "en")).toBe("es")
    expect(replyLocale("I need a playmaker for the team", "es")).toBe("en")
  })

  it("falls back to the site language when the question gives nothing away", () => {
    expect(detectMessageLocale("Curry?")).toBeNull()
    expect(replyLocale("Curry?", "es")).toBe("es")
    expect(replyLocale("", "en")).toBe("en")
  })

  it("keeps the directive itself in the target language", () => {
    expect(aiLanguageDirective("es")).toContain("español")
    expect(aiLanguageDirective("en")).toContain("English")
  })
})
