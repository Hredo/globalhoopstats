import { describe, expect, it } from "vitest"
import { diffPlayer, diffTeam, sanitizeThresholds, type PlayerSnapshot, type TeamSnapshot } from "@/lib/alerts/diff"
import { renderAlert } from "@/lib/alerts/messages"

const player = (over: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  kind: "player",
  teamId: "t1",
  teamName: "Galera CB",
  leagueSlug: "leb-oro",
  season: "2026-27",
  gamesPlayed: 6,
  ppg: 12,
  rpg: 4,
  apg: 3,
  per: 14,
  ...over,
})

const team = (over: Partial<TeamSnapshot> = {}): TeamSnapshot => ({
  kind: "team",
  season: "2026-27",
  playerIds: ["a", "b", "c"],
  headCoach: "Coach One",
  ...over,
})

describe("player alerts", () => {
  it("never fire on the first snapshot", () => {
    expect(diffPlayer(null, player({ ppg: 40 }), { ppg: 10 })).toEqual([])
  })

  it("report a team change", () => {
    const ev = diffPlayer(player(), player({ teamId: "t2", teamName: "Jara Racing" }), null)
    expect(ev).toEqual([{ type: "team_change", fromTeam: "Galera CB", toTeam: "Jara Racing" }])
  })

  it("fire once when a threshold is crossed, not every night above it", () => {
    expect(diffPlayer(player({ ppg: 14 }), player({ ppg: 15.5 }), { ppg: 15 })).toEqual([
      { type: "threshold", metric: "ppg", value: 15.5, threshold: 15 },
    ])
    expect(diffPlayer(player({ ppg: 16 }), player({ ppg: 17 }), { ppg: 15 })).toEqual([])
  })

  it("ignore thresholds on a tiny sample", () => {
    expect(diffPlayer(player({ ppg: 1 }), player({ ppg: 30, gamesPlayed: 2 }), { ppg: 15 })).toEqual([])
  })

  it("treat a new season as a fresh start for thresholds", () => {
    const ev = diffPlayer(player({ ppg: 20, season: "2025-26" }), player({ ppg: 18 }), { ppg: 15 })
    expect(ev.map((e) => e.type)).toEqual(["threshold"])
  })
})

describe("team alerts", () => {
  it("report arrivals, departures and a coaching change", () => {
    const ev = diffTeam(team(), team({ playerIds: ["a", "c", "d"], headCoach: "Coach Two" }))
    expect(ev).toEqual([
      { type: "roster_in", playerIds: ["d"] },
      { type: "roster_out", playerIds: ["b"] },
      { type: "coach_change", from: "Coach One", to: "Coach Two" },
    ])
  })

  it("collapse a season rollover into one event", () => {
    expect(diffTeam(team({ season: "2025-26" }), team({ playerIds: ["x", "y"] }))).toEqual([
      { type: "new_season", season: "2026-27" },
    ])
  })
})

describe("thresholds input", () => {
  it("keeps only known metrics within range, rounded", () => {
    expect(sanitizeThresholds({ ppg: "15.26", rpg: 999, apg: "", hack: 3, per: -1 })).toEqual({ ppg: 15.3 })
    expect(sanitizeThresholds({})).toBeNull()
    expect(sanitizeThresholds("nope")).toBeNull()
  })
})

describe("alert wording", () => {
  it("is written in the recipient's language", () => {
    const e = { type: "team_change", fromTeam: "A", toTeam: "B" } as const
    expect(renderAlert(e, "Pau Prado", "es", () => "").title).toBe("Pau Prado cambia de equipo")
    expect(renderAlert(e, "Pau Prado", "en", () => "").title).toBe("Pau Prado has changed teams")
  })
})
