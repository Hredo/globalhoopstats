import { describe, expect, it } from "vitest"
import {
  classifyShotZone,
  nbaShotZone,
  ShotZoneTally,
} from "@/lib/sources/shot-zones"
import { euroleagueGameShotZones } from "@/lib/sources/euroleague"
import { pickNewestRelevant } from "@/lib/highlights/search"

describe("shot zones", () => {
  it("buckets EuroLeague coordinates by distance and angle", () => {
    expect(classifyShotZone(10, 50, false)).toBe("paint")
    expect(classifyShotZone(-650, 60, true)).toBe("leftCorner3")
    expect(classifyShotZone(500, 500, true)).toBe("rightWing3")
    expect(classifyShotZone(0, 700, true)).toBe("frontal3")
    expect(classifyShotZone(420, 80, false)).toBe("rightCorner2")
  })

  it("maps the NBA's own zone labels", () => {
    expect(nbaShotZone("Restricted Area", "Center(C)")).toBe("paint")
    expect(nbaShotZone("Above the Break 3", "Left Side Center(LC)")).toBe(
      "leftWing3",
    )
    expect(nbaShotZone("Mid-Range", "Right Side(R)")).toBe("rightCorner2")
    expect(nbaShotZone("Backcourt", "Back Court(BC)")).toBeNull()
  })

  it("tallies one game's feed per player and club, ignoring non-shots", () => {
    const lines = euroleagueGameShotZones([
      {
        ID_PLAYER: "P015085   ",
        TEAM: "TEL       ",
        ID_ACTION: "2FGM",
        COORD_X: 56,
        COORD_Y: 269,
      },
      {
        ID_PLAYER: "P015085   ",
        TEAM: "TEL       ",
        ID_ACTION: "2FGA",
        COORD_X: 0,
        COORD_Y: 100,
      },
      {
        ID_PLAYER: "P015085   ",
        TEAM: "TEL       ",
        ID_ACTION: "3FGA",
        COORD_X: 0,
        COORD_Y: 700,
      },
      {
        ID_PLAYER: "P015085   ",
        TEAM: "TEL       ",
        ID_ACTION: "FTM",
        COORD_X: -1,
        COORD_Y: -1,
      },
    ])
    expect(lines).toEqual([
      {
        playerSourceId: "015085",
        teamSourceId: "TEL",
        zones: { paint: { m: 1, a: 2 }, frontal3: { m: 0, a: 1 } },
      },
    ])
  })

  it("sums games into season totals", () => {
    const tally = new ShotZoneTally()
    const game = [
      {
        playerSourceId: "1",
        teamSourceId: "T",
        zones: { paint: { m: 2, a: 3 } },
      },
    ]
    tally.addAll(game)
    tally.addAll(game)
    expect(tally.lines()[0]!.zones.paint).toEqual({ m: 4, a: 6 })
  })
})

describe("newest highlight", () => {
  const at = (iso: string) => new Date(iso)

  it("prefers the newest clip that names the player", () => {
    const pick = pickNewestRelevant(
      [
        {
          videoId: "aaaaaaaaaaa",
          title: "Facundo Campazzo Highlights 2025",
          snippet: "",
          publishedAt: at("2025-05-01"),
        },
        {
          videoId: "bbbbbbbbbbb",
          title: "Campazzo 18 PTS vs Barça | Real Madrid",
          snippet: "",
          publishedAt: at("2026-11-07"),
        },
        {
          videoId: "ccccccccccc",
          title: "Campazzo press conference",
          snippet: "",
          publishedAt: at("2026-11-08"),
        },
      ],
      "Facundo Campazzo",
      "Real Madrid",
    )
    expect(pick?.videoId).toBe("bbbbbbbbbbb")
  })

  it("rejects clips that only share the surname", () => {
    expect(
      pickNewestRelevant(
        [
          {
            videoId: "ddddddddddd",
            title: "Smith wins the race",
            snippet: "",
            publishedAt: at("2026-11-01"),
          },
        ],
        "Jalen Smith",
      ),
    ).toBeNull()
  })
})
