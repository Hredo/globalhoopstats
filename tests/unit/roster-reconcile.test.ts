import { describe, it, expect } from "vitest"
import {
  chunkIds,
  findDepartedIds,
  MIN_COACHES_TO_PRUNE,
  MIN_PAIRS_TO_PRUNE,
  pruneVerdict,
} from "@/lib/sync/reconcile"
import { frameSeason, seasonPromptBlock } from "@/lib/ai/season-context"
import { THIN_SEASON_GAMES } from "@/lib/seasons"

type Row = { id: string; player_id: string; team_id: string }
const key = (r: Row) => `${r.player_id}::${r.team_id}`

describe("squad reconciliation", () => {
  it("keeps players who are still on the same club", () => {
    const stored: Row[] = [
      { id: "1", player_id: "p1", team_id: "tA" },
      { id: "2", player_id: "p2", team_id: "tA" },
    ]
    const current = new Set(["p1::tA", "p2::tA"])
    expect(findDepartedIds(stored, key, current)).toEqual([])
  })

  it("drops a player who left the club", () => {
    const stored: Row[] = [
      { id: "1", player_id: "p1", team_id: "tA" },
      { id: "2", player_id: "gone", team_id: "tA" },
    ]
    const current = new Set(["p1::tA"])
    expect(findDepartedIds(stored, key, current)).toEqual(["2"])
  })

  it("drops the old club's row when a player transfers inside the league", () => {
    // The move is two facts, not one: the player is on team B now, and they are
    // no longer on team A. Only the second one needs a delete.
    const stored: Row[] = [
      { id: "old", player_id: "p1", team_id: "tA" },
      { id: "new", player_id: "p1", team_id: "tB" },
    ]
    const current = new Set(["p1::tB"])
    expect(findDepartedIds(stored, key, current)).toEqual(["old"])
  })

  it("leaves a player alone when they play two clubs in one season", () => {
    // Mid-season transfers legitimately produce two rows for one season, and
    // both are in the scrape, so neither is a departure.
    const stored: Row[] = [
      { id: "a", player_id: "p1", team_id: "tA" },
      { id: "b", player_id: "p1", team_id: "tB" },
    ]
    const current = new Set(["p1::tA", "p1::tB"])
    expect(findDepartedIds(stored, key, current)).toEqual([])
  })

  it("chunks deletes so a league-wide turnover cannot blow the placeholder cap", () => {
    const ids = Array.from({ length: 450 }, (_, i) => String(i))
    const chunks = chunkIds(ids)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(200)
    expect(chunks[2]).toHaveLength(50)
    expect(chunks.flat()).toEqual(ids)
  })

  it("chunks nothing when there is nothing to delete", () => {
    expect(chunkIds([])).toEqual([])
  })
})

describe("prune safety floor", () => {
  it("prunes on a full scrape", () => {
    expect(pruneVerdict(MIN_PAIRS_TO_PRUNE, MIN_PAIRS_TO_PRUNE)).toEqual({
      prune: true,
    })
  })

  it("refuses to prune on a suspiciously small scrape", () => {
    // A half-rendered page yielding six players must not be allowed to wipe a
    // real roster: stale members are recoverable, deleted ones are not.
    const verdict = pruneVerdict(6, MIN_PAIRS_TO_PRUNE)
    expect(verdict.prune).toBe(false)
    if (!verdict.prune) expect(verdict.reason).toContain("6")
  })

  it("uses a lower floor for coaching staff", () => {
    expect(MIN_COACHES_TO_PRUNE).toBeLessThan(MIN_PAIRS_TO_PRUNE)
    expect(pruneVerdict(MIN_COACHES_TO_PRUNE, MIN_COACHES_TO_PRUNE).prune).toBe(
      true,
    )
  })
})

describe("season framing for the AI surfaces", () => {
  const history = [
    { seasonName: "2026-27", gamesPlayed: 0 },
    { seasonName: "2025-26", gamesPlayed: 34 },
    { seasonName: "2024-25", gamesPlayed: 12 },
  ]

  it("treats a full season as able to stand on its own", () => {
    const f = frameSeason({ seasonName: "2025-26", gamesPlayed: 34 }, history)
    expect(f).toEqual({ current: "2025-26", thin: false, fallback: null })
  })

  it("flags a season with no games played and points at the richest prior one", () => {
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 0 }, history)
    expect(f).toEqual({
      current: "2026-27",
      thin: true,
      fallback: "2025-26",
    })
  })

  it("prefers the richest earlier season, not merely the previous one", () => {
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 1 }, [
      { seasonName: "2026-27", gamesPlayed: 1 },
      { seasonName: "2025-26", gamesPlayed: 3 },
      { seasonName: "2024-25", gamesPlayed: 30 },
    ])
    expect(f?.fallback).toBe("2024-25")
  })

  it("has no fallback for a debutant", () => {
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 0 }, [
      { seasonName: "2026-27", gamesPlayed: 0 },
    ])
    expect(f).toEqual({ current: "2026-27", thin: true, fallback: null })
  })

  it("uses the busiest season when there is no current line at all", () => {
    const f = frameSeason(null, history)
    expect(f).toEqual({ current: "2025-26", thin: false, fallback: null })
  })

  it("returns nothing for a player with no seasons", () => {
    expect(frameSeason(null, [])).toBeNull()
  })

  it("agrees with the shared thinness threshold", () => {
    const justEnough = frameSeason(
      { seasonName: "2026-27", gamesPlayed: THIN_SEASON_GAMES },
      history,
    )
    expect(justEnough?.thin).toBe(false)
    const oneShort = frameSeason(
      { seasonName: "2026-27", gamesPlayed: THIN_SEASON_GAMES - 1 },
      history,
    )
    expect(oneShort?.thin).toBe(true)
  })
})

describe("season prompt block", () => {
  it("names the season in both languages", () => {
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 30 }, [])
    expect(seasonPromptBlock(f, 30, "en")).toContain("2026-27")
    expect(seasonPromptBlock(f, 30, "es")).toContain("temporada 2026-27")
  })

  it("tells the model to lean on the earlier season and say so", () => {
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 0 }, [
      { seasonName: "2026-27", gamesPlayed: 0 },
      { seasonName: "2025-26", gamesPlayed: 34 },
    ])
    const en = seasonPromptBlock(f, 0, "en")
    expect(en).toContain("2025-26")
    expect(en).toMatch(/no games have been played/i)
    const es = seasonPromptBlock(f, 0, "es")
    expect(es).toContain("2025-26")
    expect(es).toMatch(/ningún partido/i)
  })

  it("admits there is nothing to go on for a debutant", () => {
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 0 }, [])
    expect(seasonPromptBlock(f, 0, "en")).toMatch(/not enough data/i)
  })

  it("is never a markdown heading", () => {
    // A model shown "## " titles writes them back; the data block deliberately
    // uses the same plain "LABEL —" shape as everything around it.
    const f = frameSeason({ seasonName: "2026-27", gamesPlayed: 0 }, [])
    expect(seasonPromptBlock(f, 0, "en")).not.toMatch(/^#{1,6}\s/m)
    expect(seasonPromptBlock(f, 0, "es")).not.toMatch(/^#{1,6}\s/m)
  })

  it("renders nothing without a framing", () => {
    expect(seasonPromptBlock(null, null, "en")).toBe("")
  })
})
