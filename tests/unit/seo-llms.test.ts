import { describe, it, expect } from "vitest"
import { buildLlmsFullTxt, buildLlmsTxt, type LlmsLeague } from "@/lib/seo/llms"
import { SITE } from "@/lib/site"

const LEAGUES: LlmsLeague[] = [
  {
    slug: "eba",
    name: "Tercera FEB",
    seasonLabel: "2026-27",
    teamCount: 160,
    playerCount: 2100,
    lastSync: new Date("2026-10-26T06:10:00Z"),
  },
  {
    slug: "acb",
    name: "Liga Endesa",
    seasonLabel: "2026-27",
    teamCount: 18,
    playerCount: 260,
    lastSync: new Date("2026-10-28T05:00:00Z"),
  },
  {
    slug: "nba",
    name: "NBA",
    seasonLabel: "2026-27",
    teamCount: 30,
    playerCount: 480,
    lastSync: null,
  },
]

const NOW = new Date("2026-10-28T09:00:00Z")

describe("llms.txt", () => {
  const txt = buildLlmsTxt(LEAGUES, NOW)

  // llmstxt.org: an H1 with the name, then a blockquote summary.
  it("follows the llms.txt shape", () => {
    const lines = txt.split("\n")
    expect(lines[0]).toBe(`# ${SITE.name}`)
    expect(lines[2]?.startsWith("> ")).toBe(true)
    expect(txt).toMatch(/^## Leagues$/m)
  })

  it("lists every league with its figures, source and date, top flight first", () => {
    expect(txt).toContain(
      `- [Liga Endesa (Liga ACB)](${SITE.url}/leagues/acb): 18 teams, 260 players; season 2026-27; source: ACB.com; updated 2026-10-28`,
    )
    expect(txt).toContain("[Tercera FEB (formerly Liga EBA)]")
    // No sync recorded → no invented date.
    expect(txt).toMatch(
      /\[NBA\]\([^)]+\): 30 teams, 480 players; season 2026-27; source: [^;]+$/m,
    )
    expect(txt.indexOf("/leagues/nba")).toBeLessThan(
      txt.indexOf("/leagues/acb"),
    )
    expect(txt.indexOf("/leagues/acb")).toBeLessThan(
      txt.indexOf("/leagues/eba"),
    )
  })

  it("states the freshest sync and how to cite", () => {
    expect(txt).toContain("data last refreshed 2026-10-28")
    expect(txt).toMatch(/^## How to cite$/m)
    expect(txt).toContain(`${SITE.url}/methodology`)
  })

  it("points agents at the API description, not the private API", () => {
    expect(txt).toContain(`${SITE.url}/openapi.json`)
    expect(txt).toContain(`${SITE.url}/llms-full.txt`)
    expect(txt).not.toMatch(/\/api\/(?!v1)/)
  })
})

describe("llms-full.txt", () => {
  it("adds each league's scoring leaders as a table, escaping scraped names", () => {
    const full = buildLlmsFullTxt(
      LEAGUES,
      new Map([
        [
          "acb",
          [
            {
              fullName: "Ana | Pérez",
              slug: "ana-perez",
              teamName: "Real [Madrid]",
              ppg: 18.25,
            },
            { fullName: "Bea Ruiz", slug: "bea-ruiz", teamName: null, ppg: 15 },
          ],
        ],
      ]),
      NOW,
    )
    expect(full).toContain(buildLlmsTxt(LEAGUES, NOW).trimEnd())
    expect(full).toContain("### Liga Endesa (Liga ACB) — 2026-27")
    expect(full).toContain(
      `| 1 | [Ana \\| Pérez](${SITE.url}/players/ana-perez) | Real \\[Madrid\\] | 18.3 |`,
    )
    expect(full).toContain(
      `| 2 | [Bea Ruiz](${SITE.url}/players/bea-ruiz) | — | 15.0 |`,
    )
    // A league without leaders gets no empty table.
    expect(full).not.toContain("### NBA")
  })
})
