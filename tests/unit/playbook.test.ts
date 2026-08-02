import { describe, expect, it } from "vitest"
import {
  createEmptyPlay,
  createSamplePlay,
  nextLabel,
  parsePlay,
  parsePlaybookFile,
} from "@/lib/playbook/types"
import {
  clampToCourt,
  ctrlFromHandle,
  curveHandle,
  describePoint,
  pathPoint,
  threeBreakY,
} from "@/lib/playbook/geometry"
import { describePlay } from "@/lib/playbook/describe"

describe("playbook model", () => {
  it("round-trips the sample play through validation", () => {
    const play = createSamplePlay()
    const parsed = parsePlay(JSON.parse(JSON.stringify(play)))
    expect(parsed).not.toBeNull()
    expect(parsed!.frames).toHaveLength(4)
    expect(parsed!.elements).toHaveLength(6)
  })

  it("rejects garbage documents", () => {
    expect(parsePlay(null)).toBeNull()
    expect(parsePlay({})).toBeNull()
    expect(parsePlay({ ...createEmptyPlay("x"), frames: [] })).toBeNull()
  })

  it("validates a playbook export file", () => {
    const file = {
      format: "ghs-playbook",
      version: 1,
      exportedAt: new Date().toISOString(),
      plays: [createSamplePlay()],
    }
    const parsed = parsePlaybookFile(JSON.parse(JSON.stringify(file)))
    expect(parsed).not.toBeNull()
    expect(parsed!.plays).toHaveLength(1)
    expect(parsePlaybookFile({ format: "nope" })).toBeNull()
  })

  it("assigns the next free player number", () => {
    const play = createSamplePlay()
    // 1-5 taken by the sample play.
    expect(nextLabel(play.elements, "attacker")).toBe("6")
    expect(nextLabel([], "attacker")).toBe("1")
    expect(nextLabel([], "defender")).toBe("1")
  })
})

describe("playbook geometry", () => {
  it("clamps points inside the chosen court", () => {
    expect(clampToCourt({ x: -3, y: 99 }, "half")).toEqual({ x: 0.25, y: 13.75 })
    expect(clampToCourt({ x: 20, y: 20 }, "full").x).toBeCloseTo(14.75)
    expect(clampToCourt({ x: 20, y: 20 }, "full").y).toBe(20)
  })

  it("interpolates linear and curved paths", () => {
    const from = { x: 0, y: 0 }
    const to = { x: 10, y: 0 }
    expect(pathPoint(from, to, null, 0.5)).toEqual({ x: 5, y: 0 })
    const curved = pathPoint(from, to, { x: 5, y: 10 }, 0.5)
    expect(curved.x).toBeCloseTo(5)
    expect(curved.y).toBeCloseTo(5)
  })

  it("inverts the curve handle back into a control point", () => {
    const from = { x: 2, y: 3 }
    const to = { x: 12, y: 7 }
    const ctrl = { x: 4, y: 11 }
    const handle = curveHandle(from, to, ctrl)
    const back = ctrlFromHandle(from, to, handle)
    expect(back.x).toBeCloseTo(ctrl.x)
    expect(back.y).toBeCloseTo(ctrl.y)
  })

  it("puts the corner-three break where the arc meets the corner lane", () => {
    // FIBA: 6.75 m arc, corners 0.9 m from the sideline.
    expect(threeBreakY()).toBeGreaterThan(2.9)
    expect(threeBreakY()).toBeLessThan(3.1)
  })

  it("names court zones sensibly", () => {
    expect(describePoint({ x: 7.5, y: 1.5 }, "half")).toBe("restricted area")
    expect(describePoint({ x: 1, y: 1.2 }, "half")).toContain("left corner")
    expect(describePoint({ x: 7.5, y: 8.5 }, "half")).toContain("top of the")
    expect(describePoint({ x: 7.5, y: 26 }, "full")).toContain("backcourt")
  })
})

describe("playbook AI description", () => {
  it("describes the sample play with frames, zones and actions", () => {
    const text = describePlay(createSamplePlay())
    expect(text).toContain("Frame 1")
    expect(text).toContain("Frame 4")
    expect(text).toContain("sets a screen")
    expect(text).toContain("passes to")
    expect(text).toMatch(/O1/)
  })
})
