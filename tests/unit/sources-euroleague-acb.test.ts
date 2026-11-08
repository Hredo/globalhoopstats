import { beforeAll, describe, expect, it } from "vitest"
import {
  buildEuroleagueTeamStats,
  currentEuroleagueRound,
  euroleagueDisplayName,
  mapEuroleagueCoach,
  mapEuroleaguePlayer,
  mapEuroleagueStatLine,
  type ApiPerson,
} from "@/lib/sources/euroleague"
import { parseAcbStandings, parseAcbTeamStats } from "@/lib/sources/acb"
import { EntityMatcher } from "@/lib/sync/entity-matcher"

beforeAll(() => {
  // Deterministic matcher path, as in production (no Ollama).
  process.env.OLLAMA_BASE_URL = "http://example.com"
})

const club = { code: "OLY", name: "Olympiacos Piraeus" }

function person(over: Partial<ApiPerson> & { name?: string } = {}): ApiPerson {
  const { name = "VEZENKOV, SASHA", ...rest } = over
  return {
    person: {
      code: "003469",
      name,
      country: { code: "BUL", name: "Bulgaria" },
      height: 209,
      weight: 102,
      birthDate: "1995-08-06T00:00:00",
    },
    type: "J",
    active: true,
    dorsal: "14",
    positionName: "Forward",
    club,
    ...rest,
  }
}

describe("EuroLeague API mapping", () => {
  it("turns the feed's SURNAME, GIVEN capitals into a display name", () => {
    expect(euroleagueDisplayName("MOTLEY, JOHNATHAN")).toBe("Johnathan Motley")
    expect(euroleagueDisplayName("DE COLO, NANDO")).toBe("Nando De Colo")
    expect(euroleagueDisplayName("MCCORMACK, DAVID")).toBe("David McCormack")
    expect(euroleagueDisplayName("BALDWIN IV, WADE")).toBe("Wade Baldwin IV")
    expect(euroleagueDisplayName("O'NEALE, ROYCE")).toBe("Royce O'Neale")
  })

  it("maps a player with the position code the other feeds use", () => {
    expect(mapEuroleaguePlayer(person())).toMatchObject({
      sourceId: "003469",
      fullName: "Sasha Vezenkov",
      position: "F",
      nationality: "Bulgaria",
      birthdate: "1995-08-06",
      heightCm: 209,
      teamSourceId: "OLY",
    })
  })

  it("keeps a player who left the club off its roster", () => {
    expect(
      mapEuroleaguePlayer(person({ active: false }))?.teamSourceId,
    ).toBeUndefined()
  })

  it("takes head and assistant coaches only, not the rest of the delegation", () => {
    expect(
      mapEuroleagueCoach(person({ type: "E", name: "BARTZOKAS, GEORGIOS" })),
    ).toMatchObject({
      fullName: "Georgios Bartzokas",
      role: "head_coach",
      teamSourceId: "OLY",
    })
    expect(mapEuroleagueCoach(person({ type: "A" }))?.role).toBe(
      "assistant_coach",
    )
    for (const type of ["J", "D", "F", "U", "Z"]) {
      expect(mapEuroleagueCoach(person({ type }))).toBeNull()
    }
    expect(mapEuroleagueCoach(person({ type: "E", active: false }))).toBeNull()
  })

  it("maps accumulated stats to totals with field goals summed", () => {
    const s = mapEuroleagueStatLine({
      player: {
        code: "003469",
        name: "VEZENKOV, SASHA",
        team: { code: "OLY", name: "x" },
      },
      gamesPlayed: 10,
      minutesPlayed: 272.6,
      pointsScored: 191,
      twoPointersMade: 55,
      twoPointersAttempted: 78,
      threePointersMade: 13,
      threePointersAttempted: 42,
      freeThrowsMade: 42,
      freeThrowsAttempted: 48,
      offensiveRebounds: 15,
      defensiveRebounds: 45,
      totalRebounds: 60,
      assists: 10,
      steals: 6,
      turnovers: 9,
      blocks: 0,
      foulsCommited: 7,
    })
    expect(s).toMatchObject({
      playerSourceId: "003469",
      teamSourceId: "OLY",
      gamesPlayed: 10,
      minutesTotal: 273,
      fgMade: 68,
      fgAttempted: 120,
      threeMade: 13,
      reboundsTotal: 60,
      foulsTotal: 7,
      trueShootingPct: 0.677,
    })
  })

  it("builds the table with per-game points and possession-based ratings", () => {
    const line = (code: string, pts: number) => ({
      team: { code },
      gamesPlayed: 10,
      pointsScored: pts,
      twoPointersAttempted: 400,
      threePointersAttempted: 250,
      freeThrowsAttempted: 200,
      offensiveRebounds: 100,
      turnovers: 130,
    })
    const [row] = buildEuroleagueTeamStats(
      [
        {
          position: 1,
          gamesPlayed: 10,
          gamesWon: 8,
          gamesLost: 2,
          pointsFor: 862,
          pointsAgainst: 776,
          club,
        },
      ],
      [line("OLY", 862)],
      [line("OLY", 776)],
    )
    // possessions = 650 - 100 + 130 + 0.4·200 = 760 → 76 per game
    expect(row).toMatchObject({
      teamSourceId: "OLY",
      wins: 8,
      losses: 2,
      winPct: 0.8,
      pointsFor: 86.2,
      pointsAgainst: 77.6,
      offRtg: 113.4,
      defRtg: 102.1,
      pace: 91.2,
    })
  })

  it("reads standings from the last round that has tipped off", () => {
    const rounds = [
      { round: 1, minGameStartDate: "2026-10-01T00:00:00" },
      { round: 2, minGameStartDate: "2026-10-08T00:00:00" },
      { round: 3, minGameStartDate: "2026-10-15T00:00:00" },
    ]
    expect(currentEuroleagueRound(rounds, new Date("2026-10-10"))).toBe(2)
    expect(currentEuroleagueRound(rounds, new Date("2026-09-01"))).toBeNull()
  })
})

/** An acb.com RSC payload shaped like the live pages (trimmed). */
function acbStatsRsc(editionId: number): string {
  const editions = `{"id":90,"seasonStartYear":2025,"seasonEndYear":2026,"rounds":[]},{"id":91,"seasonStartYear":2026,"seasonEndYear":2027,"rounds":[]}`
  const row = (id: number, games: number) =>
    `{"player":{"id":${id},"firstName":"Darío","lastName":"Brizuela","editionId":${editionId}},` +
    `"totals":{"numGames":${games},"timePlayed":5525,"points":50,"threePointersMade":8,"threePointersAttempted":21,` +
    `"twoPointersMade":10,"twoPointersAttempted":12,"freeThrowsMade":6,"freeThrowsAttempted":7,"rebounds":7,` +
    `"offensiveRebounds":2,"defensiveRebounds":5,"assists":10,"steals":2,"turnovers":5,"blocks":0,` +
    `"personalFouls":13,"plusMinus":23},"averages":{"numGames":${games}}}`
  return `{"messages":{"players":"Jugadores"},"editions":[${editions}]},"players":[${row(20209919, 5)},${row(30000001, 0)}]`
}

describe("acb.com stats", () => {
  it("reads season totals from a club's /estadisticas payload", () => {
    const out = parseAcbTeamStats(acbStatsRsc(91), "acb-2", 2026)
    expect(out).toHaveLength(1) // the 0-game row is dropped
    expect(out[0]).toMatchObject({
      playerSourceId: "acb-20209919",
      teamSourceId: "acb-2",
      season: 2026,
      gamesPlayed: 5,
      minutesTotal: 92, // 5525 s
      pointsTotal: 50,
      fgMade: 18,
      fgAttempted: 33,
      threeMade: 8,
      foulsTotal: 13,
      plusMinus: 23,
    })
  })

  it("ignores last season's rows while the page still shows them", () => {
    expect(parseAcbTeamStats(acbStatsRsc(90), "acb-2", 2026)).toEqual([])
  })

  it("resolves the table's de-duplicated team references", () => {
    const team = (clubId: number) =>
      `{"clubId":${clubId},"fullName":"Club ${clubId}"}`
    const rsc =
      `{"standings":"Clasificación"},"standings":[` +
      `{"team":${team(9)},"position":1,"matchesPlayed":6,"wins":6,"losses":0,"pointsFor":654,"pointsAgainst":526,` +
      `"rounds":[{"matchData":{"homeTeam":"$43:props:data:standings:0:team","awayTeam":${team(14)}}}]},` +
      `{"team":"$43:props:data:standings:0:rounds:0:matchData:awayTeam","position":2,"matchesPlayed":7,"wins":5,"losses":2,"pointsFor":600,"pointsAgainst":560},` +
      `{"team":${team(22)},"position":3,"matchesPlayed":0,"wins":0,"losses":0,"pointsFor":0,"pointsAgainst":0}]`
    const out = parseAcbStandings(rsc, 2026)
    expect(out.map((r) => r.teamSourceId)).toEqual(["acb-9", "acb-14"])
    expect(out[0]).toMatchObject({
      wins: 6,
      losses: 0,
      pointsFor: 109,
      pointsAgainst: 87.7,
      position: 1,
    })
    expect(out[1]).toMatchObject({ gamesPlayed: 7, winPct: 0.714 })
  })
})

describe("EntityMatcher name suffixes", () => {
  it("matches a player whose feed adds a generational suffix", async () => {
    const matcher = new EntityMatcher([
      {
        id: "wb",
        fullName: "Wade Baldwin",
        nationality: null,
        position: "G",
        heightCm: 193,
        tiers: ["top"],
      },
    ])
    expect(
      await matcher.resolve({
        fullName: "Wade Baldwin IV",
        league: "EuroLeague",
      }),
    ).toEqual({
      kind: "existing",
      playerId: "wb",
    })
  })

  it("still keeps two different people with the same surname apart", async () => {
    const matcher = new EntityMatcher([
      {
        id: "kb",
        fullName: "Kamar Baldwin",
        nationality: null,
        position: "G",
        heightCm: 185,
        tiers: ["top"],
      },
    ])
    expect(
      await matcher.resolve({
        fullName: "Wade Baldwin IV",
        league: "EuroLeague",
      }),
    ).toEqual({
      kind: "new",
    })
  })
})
