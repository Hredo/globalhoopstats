import { describePoint } from "@/lib/playbook/geometry"
import type { Play, PlayElement, PlayFrame } from "@/lib/playbook/types"

/**
 * Serializes a play into a precise, LLM-friendly English scouting text:
 * alignment per frame (named zones) plus the action sequence. The AI route
 * feeds this to the user's engine for tactical analysis; keeping it factual
 * and structured is what lets a small model reason about the play.
 */

function elementName(el: PlayElement | undefined): string {
  if (!el) return "unknown"
  if (el.kind === "attacker") {
    const base = `O${el.label}`
    return el.player ? `${base} (${el.player.name}${el.player.position ? `, ${el.player.position}` : ""})` : base
  }
  if (el.kind === "defender") return `X${el.label}`
  if (el.kind === "ball") return "the ball"
  if (el.kind === "coach") return "the coach"
  return `cone ${el.label}`.trim()
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

function actionLine(play: Play, frame: PlayFrame, next: PlayFrame | undefined, actionIdx: number): string | null {
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
      return `  - ${elementName(el)} hands the ball off to ${elementName(target)}.`
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

export function describePlay(play: Play): string {
  const lines: string[] = []
  lines.push(`Play name: ${play.name}`)
  if (play.description) lines.push(`Coach's description: ${play.description}`)
  if (play.team) lines.push(`Designed for: ${play.team.name} (${play.team.leagueSlug.toUpperCase()})`)
  lines.push(`Court: ${play.courtType === "half" ? "half court" : "full court"}`)
  const attackers = play.elements.filter((e) => e.kind === "attacker").length
  const defenders = play.elements.filter((e) => e.kind === "defender").length
  lines.push(
    `Personnel: ${attackers} offensive players${defenders ? `, ${defenders} defenders drawn` : ""}. ${play.frames.length} sequences (frames).`,
  )
  lines.push("")

  play.frames.forEach((frame, i) => {
    lines.push(`## Frame ${i + 1}${frame.note ? ` — ${frame.note}` : ""}`)
    lines.push(`Alignment:`)
    lines.push(...frameAlignment(play, frame))
    const next = play.frames[i + 1]
    if (frame.actions.length > 0) {
      lines.push(`Actions into the next frame:`)
      frame.actions.forEach((_, idx) => {
        const line = actionLine(play, frame, next, idx)
        if (line) lines.push(line)
      })
    } else if (next) {
      lines.push(`(No drawn actions; players relocate directly.)`)
    }
    lines.push("")
  })

  return lines.join("\n")
}
