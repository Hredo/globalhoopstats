import { describe, expect, it } from "vitest"
import { mapNbaCoach } from "@/lib/sources/nba"

const row = (over: Record<string, string | number | null>) => ({
  TEAM_ID: 1610612747,
  SEASON: "2026",
  COACH_ID: 200755,
  COACH_NAME: "JJ Redick",
  COACH_TYPE: "Head Coach",
  ...over,
})

describe("mapNbaCoach", () => {
  it("maps a commonteamroster head coach to the club's team id", () => {
    expect(mapNbaCoach(row({}))).toEqual({
      sourceId: "nba-coach-200755-1610612747",
      fullName: "JJ Redick",
      role: "head_coach",
      teamSourceId: "1610612747",
    })
  })

  it("keeps assistants (lead or not) apart from the rest of the staff", () => {
    expect(mapNbaCoach(row({ COACH_TYPE: "Assistant Coach" }))?.role).toBe(
      "assistant_coach",
    )
    expect(mapNbaCoach(row({ COACH_TYPE: "Lead Assistant Coach" }))?.role).toBe(
      "assistant_coach",
    )
    expect(mapNbaCoach(row({ COACH_TYPE: "Trainer" }))?.role).toBe("staff")
  })

  it("skips rows without a name or ids", () => {
    expect(mapNbaCoach(row({ COACH_NAME: "" }))).toBeNull()
    expect(mapNbaCoach(row({ COACH_ID: null }))).toBeNull()
    expect(mapNbaCoach(row({ TEAM_ID: null }))).toBeNull()
  })
})
