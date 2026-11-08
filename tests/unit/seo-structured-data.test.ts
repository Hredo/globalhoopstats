import { describe, it, expect } from "vitest"
import {
  datasetJsonLd,
  playerJsonLd,
  profilePageJsonLd,
  teamJsonLd,
} from "@/lib/seo/structured-data"
import { SITE } from "@/lib/site"

describe("structured data", () => {
  it("wraps a player in a ProfilePage dated by the last sync", () => {
    const page = profilePageJsonLd(
      playerJsonLd({
        fullName: "Ana Pérez",
        slug: "ana-perez",
        leagueName: "Primera FEB",
      }),
      new Date("2026-10-26T06:10:00Z"),
    )
    expect(page["@type"]).toBe("ProfilePage")
    expect(page.dateModified).toBe("2026-10-26T06:10:00.000Z")
    expect(page.url).toBe(`${SITE.url}/players/ana-perez`)
    const person = page.mainEntity as Record<string, unknown>
    expect(person["@type"]).toBe("Person")
    // Only the top-level node carries @context.
    expect(person["@context"]).toBeUndefined()
  })

  it("omits dateModified rather than inventing one", () => {
    const page = profilePageJsonLd(
      playerJsonLd({
        fullName: "Ana Pérez",
        slug: "ana-perez",
        leagueName: "Primera FEB",
      }),
      null,
    )
    expect(page).not.toHaveProperty("dateModified")
  })

  it("describes a league-season as a Dataset crediting the publisher", () => {
    const ds = datasetJsonLd({
      leagueName: "Liga Endesa",
      leagueSlug: "acb",
      season: "2026-27",
      description: "Estadísticas de la Liga Endesa en la temporada 2026-27.",
      teams: 18,
      players: 260,
      dateModified: new Date("2026-10-28T05:00:00Z"),
      upstream: { name: "ACB.com", url: "https://www.acb.com" },
      locale: "es",
    })
    expect(ds["@type"]).toBe("Dataset")
    // Google requires name and description on a Dataset.
    expect(ds.name).toContain("Liga Endesa 2026-27")
    expect(ds.description).toBeTruthy()
    expect(ds.url).toBe(`${SITE.url}/leagues/acb`)
    expect(ds.temporalCoverage).toBe("2026-27")
    expect(ds.isBasedOn).toMatchObject({ name: "ACB.com" })
    expect(ds.dateModified).toBe("2026-10-28T05:00:00.000Z")
  })

  it("lists the roster and head coach on a team", () => {
    const team = teamJsonLd({
      name: "Real Madrid",
      slug: "real-madrid",
      leagueSlug: "acb",
      leagueName: "Liga Endesa",
      athletes: [{ name: "Ana Pérez", slug: "ana-perez" }],
      coach: "Coach Name",
    })
    expect(team.athlete).toEqual([
      {
        "@type": "Person",
        name: "Ana Pérez",
        url: `${SITE.url}/players/ana-perez`,
      },
    ])
    expect(team.coach).toEqual({ "@type": "Person", name: "Coach Name" })
    expect(
      teamJsonLd({ name: "X", slug: "x", leagueSlug: "acb", leagueName: "L" }),
    ).not.toHaveProperty("athlete")
  })
})
