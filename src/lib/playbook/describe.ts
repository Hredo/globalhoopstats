import { describePoint } from "@/lib/playbook/geometry"
import type { Play, PlayElement, PlayFrame } from "@/lib/playbook/types"

function elementName(el: PlayElement | undefined): string {
  if (!el) return "unknown"
  if (el.kind === "attacker") {
    const base = `O${el.label}`
    return el.player
      ? `${base} (${el.player.name}${el.player.position ? `, ${el.player.position}` : ""})`
      : base
  }
  if (el.kind === "defender") return `X${el.label}`
  if (el.kind === "ball") return "the ball"
  if (el.kind === "coach") return "the coach"
  return `cone ${el.label}`
}

function annotationList(play: Play): string[] {
  const lines: string[] = []
  const cones = play.elements.filter((e) => e.kind === "cone")
  if (cones.length > 0) {
    lines.push(`Cones (fixed markers): ${cones.map((c) => c.label).join(", ")}`)
  }
  return lines
}

function frameAlignment(play: Play, frame: PlayFrame): string[] {
  const lines: string[] = []
  for (const el of play.elements) {
    if (el.kind === "cone" || el.kind === "coach") continue
    const pos = frame.positions[el.id]
    if (!pos) continue
    lines.push(`  - ${elementName(el)}: ${describePoint(pos, play.courtType)}`)
  }
  return lines
}

function actionLine(
  play: Play,
  frame: PlayFrame,
  next: PlayFrame | undefined,
  actionIdx: number,
): string | null {
  const action = frame.actions[actionIdx]
  const el = play.elements.find((e) => e.id === action.elementId)
  if (!el) return null
  const from = frame.positions[action.elementId]
  const to = next?.positions[action.elementId] ?? from
  const target = action.targetElementId
    ? play.elements.find((e) => e.id === action.targetElementId)
    : undefined

  switch (action.type) {
    case "pass": {
      const dest = target && next?.positions[target.id]
      return `  - ${elementName(el)} passes to ${elementName(target)}${dest ? ` at the ${describePoint(dest, play.courtType)}` : ""}.`
    }
    case "handoff":
      return `  - ${elementName(el)} hands off to ${elementName(target)}${to ? ` at the ${describePoint(to, play.courtType)}` : ""}.`
    case "screen": {
      const spot = to ?? from
      return `  - ${elementName(el)} sets a screen${target ? ` for ${elementName(target)}` : ""}${spot ? ` near the ${describePoint(spot, play.courtType)}` : ""}.`
    }
    case "dribble":
      return from && to
        ? `  - ${elementName(el)} dribbles from the ${describePoint(from, play.courtType)} to the ${describePoint(to, play.courtType)}.`
        : null
    case "cut":
      return from && to
        ? `  - ${elementName(el)} cuts from the ${describePoint(from, play.courtType)} to the ${describePoint(to, play.courtType)}.`
        : null
  }
}

function ballLocation(play: Play, frame: PlayFrame): string | null {
  const ballEl = play.elements.find((e) => e.kind === "ball")
  if (!ballEl) return null
  const pos = frame.positions[ballEl.id]
  if (!pos) return null
  return `  - Ball: ${describePoint(pos, play.courtType)}`
}

export function describePlay(play: Play): string {
  const lines: string[] = []
  lines.push(`Play name: ${play.name}`)
  if (play.description) lines.push(`Coach's description: ${play.description}`)
  if (play.team)
    lines.push(
      `Designed for: ${play.team.name} (${play.team.leagueSlug.toUpperCase()})`,
    )
  lines.push(
    `Court: ${play.courtType === "half" ? "half court" : "full court"}`,
  )

  const attackers = play.elements.filter((e) => e.kind === "attacker")
  const defenders = play.elements.filter((e) => e.kind === "defender")
  const hasBall = play.elements.some((e) => e.kind === "ball")
  lines.push(
    `Personnel: ${attackers.length} offensive players (${attackers.map((a) => `O${a.label}`).join(", ")})`,
  )
  if (defenders.length > 0) {
    lines.push(
      `Defenders: ${defenders.length} (${defenders.map((d) => `X${d.label}`).join(", ")})`,
    )
  }
  if (hasBall) lines.push(`Ball: included on court`)

  const annotations = annotationList(play)
  if (annotations.length > 0) lines.push("", ...annotations)

  lines.push(
    `Frames: ${play.frames.length}. Each frame is a snapshot of positions; actions describe movement into the next frame.`,
  )
  lines.push("")

  play.frames.forEach((frame, i) => {
    lines.push(`## Frame ${i + 1}${frame.note ? ` — ${frame.note}` : ""}`)

    const ballLine = ballLocation(play, frame)
    if (ballLine) lines.push(`Ball position:`, ballLine)

    lines.push(`Alignment:`)
    lines.push(...frameAlignment(play, frame))

    const next = play.frames[i + 1]
    if (frame.actions.length > 0) {
      lines.push(`Actions into the next frame:`)
      for (let idx = 0; idx < frame.actions.length; idx++) {
        const line = actionLine(play, frame, next, idx)
        if (line) lines.push(line)
      }
    } else if (next) {
      lines.push(`(No drawn actions; players relocate directly.)`)
    }
    lines.push("")
  })

  return lines.join("\n")
}
