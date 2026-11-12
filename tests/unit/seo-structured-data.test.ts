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

describe("structured data for the women's side", () => {
  it("marks a women's player and her team as Female, with her birth date", () => {
    const person = playerJsonLd({
      fullName: "Laia Puig",
      slug: "lf-endesa-laia-puig",
      birthdate: "2001-03-12",
      teamName: "Spar Girona",
      leagueName: "Liga Femenina Endesa",
      gender: "women",
    })
    expect(person.gender).toBe("https://schema.org/Female")
    expect(person.birthDate).toBe("2001-03-12")
    expect((person.memberOf as Record<string, unknown>).gender).toBe(
      "https://schema.org/Female",
    )
  })

  it("leaves gender out when the caller does not say", () => {
    expect(
      playerJsonLd({ fullName: "X", slug: "x", leagueName: "ACB" }),
    ).not.toHaveProperty("gender")
  })

  it("lists the whole staff with roles, not only the head coach", () => {
    const team = teamJsonLd({
      name: "Spar Girona",
      slug: "spar-girona-femenino",
      leagueSlug: "lf-endesa",
      leagueName: "Liga Femenina Endesa",
      coach: "Head",
      staff: [
        { name: "Head", role: "Entrenador principal" },
        { name: "Second", role: "Asistente" },
      ],
      gender: "women",
    })
    expect(team.gender).toBe("https://schema.org/Female")
    expect(team.coach).toEqual([
      { "@type": "Person", name: "Head", jobTitle: "Entrenador principal" },
      { "@type": "Person", name: "Second", jobTitle: "Asistente" },
    ])
  })

  it("tags a women's dataset with the women's search terms", () => {
    const ds = datasetJsonLd({
      leagueName: "Liga Femenina Endesa",
      leagueSlug: "lf-endesa",
      season: "2026-27",
      description: "d",
      teams: 16,
      players: 161,
      dateModified: null,
      upstream: null,
      locale: "es",
      gender: "women",
    })
    expect(ds.keywords).toContain("estadísticas baloncesto femenino")
  })
})
