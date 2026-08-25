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
  mirrorX,
  nearestRim,
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

  it("round-trips the tools added for on-court use", () => {
    const play = createEmptyPlay("tools")
    play.elements.push(
      { id: "chair1", kind: "chair", label: "" },
      { id: "note1", kind: "text", label: "ICE the ball screen" },
    )
    play.frames[0].positions = {
      chair1: { x: 5, y: 5 },
      note1: { x: 7.5, y: 9 },
    }
    play.frames[0].actions = [{ id: "a1", type: "shot", elementId: "chair1", via: null }]
    play.frames[0].drawings = [
      { id: "d1", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2.5 }] },
    ]

    const parsed = parsePlay(JSON.parse(JSON.stringify(play)))
    expect(parsed).not.toBeNull()
    expect(parsed!.elements.map((e) => e.kind)).toEqual(["chair", "text"])
    expect(parsed!.elements[1].label).toBe("ICE the ball screen")
    expect(parsed!.frames[0].actions[0].type).toBe("shot")
    expect(parsed!.frames[0].drawings).toHaveLength(1)
    expect(parsed!.frames[0].drawings![0].points).toHaveLength(3)
  })

  it("drops freehand strokes that are not really strokes", () => {
    const play = createEmptyPlay("stroke")
    // A single point is a stray tap, not a line: the schema must reject it.
    play.frames[0].drawings = [{ id: "d1", points: [{ x: 1, y: 1 }] }]
    expect(parsePlay(JSON.parse(JSON.stringify(play)))).toBeNull()
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

  it("mirrors a point onto the other side of the floor", () => {
    // 15 m wide: the left corner becomes the right corner, the top of the key
    // does not move.
    expect(mirrorX({ x: 1.2, y: 1.6 })).toEqual({ x: 13.8, y: 1.6 })
    expect(mirrorX({ x: 7.5, y: 9 })).toEqual({ x: 7.5, y: 9 })
  })

  it("aims a shot at the basket the shooter is attacking", () => {
    expect(nearestRim({ x: 2, y: 10 }, "half")).toEqual({ x: 7.5, y: 1.575 })
    // Full court: whichever end the shooter is standing at.
    expect(nearestRim({ x: 2, y: 4 }, "full").y).toBeCloseTo(1.575)
    expect(nearestRim({ x: 2, y: 24 }, "full").y).toBeCloseTo(26.425)
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
    expect(text).toContain("FRAME 1")
    expect(text).toContain("FRAME 4")
    expect(text).toContain("sets a screen")
    expect(text).toContain("passes to")
    expect(text).toMatch(/O1/)
  })

  it("labels frames without markdown headings", () => {
    // Shown a document of "## " titles, a small model writes one back: a
    // breakdown came out as "Frame 1 — 2-player Pick & Roll / Frame 2 —
    // 3-player Pick & Roll", with the coach's question never answered.
    for (const line of describePlay(createSamplePlay()).split("\n")) {
      expect(line, line).not.toMatch(/^#{1,6}\s/)
    }
  })

  it("hands the AI the shots and the on-court notes", () => {
    const play = createEmptyPlay("shot play")
    play.elements.push(
      { id: "p1", kind: "attacker", label: "1" },
      { id: "note1", kind: "text", label: "no middle" },
    )
    play.frames[0].positions = { p1: { x: 7.5, y: 9 }, note1: { x: 3, y: 3 } }
    play.frames[0].actions = [{ id: "a1", type: "shot", elementId: "p1", via: null }]

    const text = describePlay(play)
    expect(text).toContain("O1 shoots from the")
    expect(text).toContain('"no middle"')
  })
})
