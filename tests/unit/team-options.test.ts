import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/client", () => ({ getDb: vi.fn(), rawRows: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))

import { latestSeasonByLeague, toTeamOptions } from "@/lib/data/teams"
import { displayTeamName } from "@/lib/format"

describe("team picker scope", () => {
  it("takes each league's own newest season, not one global season", () => {
    const latest = latestSeasonByLeague([
      { leagueId: "nba", season: "2025-26" },
      { leagueId: "nba", season: "2026-27" },
      { leagueId: "eba", season: "2024-25" },
      { leagueId: "eba", season: "2025-26" },
    ])
    expect(latest.get("nba")).toBe("2026-27")
    // A league that has not rolled over yet still offers its clubs.
    expect(latest.get("eba")).toBe("2025-26")
  })

  it("folds legacy EuroLeague E20xx labels into the shared season label", () => {
    const latest = latestSeasonByLeague([
      { leagueId: "el", season: "E2026" },
      { leagueId: "el", season: "2025-26" },
    ])
    expect(latest.get("el")).toBe("2026-27")
  })
})

describe("team picker labels", () => {
  it("shows the current league name instead of the slug", () => {
    const options = toTeamOptions([
      {
        id: "1",
        name: "BIELE ISB",
        slug: "biele-isb",
        leagueSlug: "leb-plata",
        leagueName: "LEB Plata",
      },
      {
        id: "2",
        name: "BÀSQUET MENORCA",
        slug: "menorca",
        leagueSlug: "leb-oro",
        leagueName: "LEB Oro",
      },
      {
        id: "3",
        name: "BAUHAUS GODELLA",
        slug: "godella",
        leagueSlug: "eba",
        leagueName: "Liga EBA",
      },
      {
        id: "4",
        name: "Bayern München",
        slug: "bayern",
        leagueSlug: "euroleague",
        leagueName: "EuroLeague",
      },
    ])
    expect(options.map((o) => [o.name, o.leagueName])).toEqual([
      ["Bàsquet Menorca", "Primera FEB"],
      ["Bauhaus Godella", "Tercera FEB"],
      ["Bayern München", "EuroLeague"],
      ["Biele ISB", "Segunda FEB"],
    ])
  })

  it("keeps the DB name for a league the app does not know", () => {
    const [option] = toTeamOptions([
      {
        id: "1",
        name: "Club",
        slug: "club",
        leagueSlug: "lnb",
        leagueName: "LNB Pro A",
      },
    ])
    expect(option.leagueName).toBe("LNB Pro A")
  })
})

describe("displayTeamName", () => {
  it("rewrites all-caps FEB names and keeps initials", () => {
    expect(displayTeamName("BAUBLOCK GYMNÁSTICA AVANZA EL PUERTO")).toBe(
      "Baublock Gymnástica Avanza el Puerto",
    )
    expect(displayTeamName("BOSCO MÉRIDA PATRIMONIO DE LA HUMANIDAD")).toBe(
      "Bosco Mérida Patrimonio de la Humanidad",
    )
    expect(displayTeamName("CB L'HOSPITALET")).toBe("CB L'Hospitalet")
    expect(displayTeamName("CD SAN FERNANDO")).toBe("CD San Fernando")
  })

  it("leaves mixed-case names alone", () => {
    expect(displayTeamName("Real Madrid")).toBe("Real Madrid")
    expect(displayTeamName("LA Clippers")).toBe("LA Clippers")
  })
})
