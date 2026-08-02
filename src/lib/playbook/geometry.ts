import {
  COURT_WIDTH_M,
  FULL_COURT_LENGTH_M,
  HALF_COURT_LENGTH_M,
  type CourtType,
  type Point,
} from "@/lib/playbook/types"

/**
 * Court geometry and path math for the playbook editor. Everything works in
 * FIBA metres (see types.ts); the SVG layer multiplies by `SCALE` px/m.
 */

export const SCALE = 50

/** FIBA dimensions, all in metres from the top-left corner of the court. */
export const FIBA = {
  width: COURT_WIDTH_M,
  half: HALF_COURT_LENGTH_M,
  full: FULL_COURT_LENGTH_M,
  /** Rim centre distance from the baseline. */
  rimFromBaseline: 1.575,
  backboardFromBaseline: 1.2,
  keyWidth: 4.9,
  keyDepth: 5.8,
  ftCircleRadius: 1.8,
  restrictedRadius: 1.25,
  threeRadius: 6.75,
  /** Corner three: straight line 0.9 m from each sideline. */
  cornerThreeInset: 0.9,
  centerCircleRadius: 1.8,
}

/** Y (from the near baseline) where the 3pt arc meets the corner lines. */
export function threeBreakY(): number {
  const dx = COURT_WIDTH_M / 2 - FIBA.cornerThreeInset
  return FIBA.rimFromBaseline + Math.sqrt(FIBA.threeRadius ** 2 - dx ** 2)
}

export function courtLength(courtType: CourtType): number {
  return courtType === "half" ? FIBA.half : FIBA.full
}

export function clampToCourt(p: Point, courtType: CourtType): Point {
  const m = 0.25
  return {
    x: Math.min(COURT_WIDTH_M - m, Math.max(m, p.x)),
    y: Math.min(courtLength(courtType) - m, Math.max(m, p.y)),
  }
}

// ── Path math ────────────────────────────────────────────────────────────────

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Point on a quadratic bézier (linear when ctrl is null) at t ∈ [0,1]. */
export function pathPoint(from: Point, to: Point, ctrl: Point | null, t: number): Point {
  if (!ctrl) {
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  }
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
  }
}

/** Tangent angle (radians) of the path at t, for arrowheads. */
export function pathAngle(from: Point, to: Point, ctrl: Point | null, t: number): number {
  const a = pathPoint(from, to, ctrl, Math.max(0, t - 0.02))
  const b = pathPoint(from, to, ctrl, Math.min(1, t + 0.02))
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/**
 * The visible curve midpoint (t = 0.5). Dragging this handle produces a new
 * bézier control point via the inverse: ctrl = 2·M − (from+to)/2.
 */
export function curveHandle(from: Point, to: Point, ctrl: Point | null): Point {
  return pathPoint(from, to, ctrl, 0.5)
}

export function ctrlFromHandle(from: Point, to: Point, handle: Point): Point {
  return {
    x: 2 * handle.x - (from.x + to.x) / 2,
    y: 2 * handle.y - (from.y + to.y) / 2,
  }
}

/** SVG `d` for the movement path in court metres (caller scales the group). */
export function pathD(from: Point, to: Point, ctrl: Point | null): string {
  if (!ctrl) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  return `M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${to.x} ${to.y}`
}

/**
 * Zig-zag polyline along the path for dribble lines (the standard wavy
 * notation). Amplitude and wavelength are in metres.
 */
export function dribblePathD(from: Point, to: Point, ctrl: Point | null): string {
  const len = ctrl
    ? distance(from, ctrl) + distance(ctrl, to)
    : distance(from, to)
  const waves = Math.max(3, Math.round(len / 0.55))
  const amp = 0.22
  let d = `M ${from.x} ${from.y}`
  for (let i = 1; i <= waves; i++) {
    const t = i / waves
    const p = pathPoint(from, to, ctrl, t)
    if (i === waves) {
      d += ` L ${p.x} ${p.y}`
      break
    }
    const ang = pathAngle(from, to, ctrl, t)
    const side = i % 2 === 0 ? 1 : -1
    const nx = Math.cos(ang + Math.PI / 2) * amp * side
    const ny = Math.sin(ang + Math.PI / 2) * amp * side
    d += ` L ${p.x + nx} ${p.y + ny}`
  }
  return d
}

/** Ease used for playback interpolation between frames. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// ── Zone naming (feeds the AI play description) ─────────────────────────────

/**
 * Human name of a court location, e.g. "left corner (3pt)", "top of the key",
 * "restricted area". `courtType` full: locations beyond half-court are named
 * relative to the backcourt.
 */
export function describePoint(p: Point, courtType: CourtType): string {
  let y = p.y
  let prefix = ""
  if (courtType === "full" && y > FIBA.full / 2) {
    // Mirror into the far half so the same zone names apply.
    y = FIBA.full - y
    prefix = "backcourt "
  }
  const x = p.x
  const rim = { x: COURT_WIDTH_M / 2, y: FIBA.rimFromBaseline }
  const dRim = Math.hypot(x - rim.x, y - rim.y)
  const side = x < COURT_WIDTH_M / 2 - 1 ? "left" : x > COURT_WIDTH_M / 2 + 1 ? "right" : "middle"

  if (courtType === "half" || y <= FIBA.half) {
    if (y > FIBA.half - 1.2) return `${prefix}half-court line`
    if (dRim <= FIBA.restrictedRadius + 0.3) return `${prefix}restricted area`
    if (
      Math.abs(x - rim.x) <= FIBA.keyWidth / 2 &&
      y <= FIBA.keyDepth
    ) {
      return y <= 3
        ? `${prefix}${side === "middle" ? "" : side + " "}low post`
        : `${prefix}${side === "middle" ? "" : side + " "}high post`
    }
    const elbowY = FIBA.keyDepth
    if (Math.abs(y - elbowY) < 1 && Math.abs(Math.abs(x - rim.x) - FIBA.keyWidth / 2) < 1) {
      return `${prefix}${side} elbow`
    }
    const beyondArc = dRim > FIBA.threeRadius || (y < threeBreakY() && Math.abs(x - rim.x) > COURT_WIDTH_M / 2 - FIBA.cornerThreeInset - 0.2)
    if (y < threeBreakY() + 0.5 && Math.abs(x - rim.x) > 4.5) {
      return `${prefix}${side} corner${beyondArc ? " (3pt)" : ""}`
    }
    if (beyondArc) {
      if (side === "middle") return `${prefix}top of the arc (3pt)`
      return `${prefix}${side} wing (3pt)`
    }
    if (side === "middle" && y >= FIBA.keyDepth) return `${prefix}top of the key`
    return `${prefix}${side} wing (mid-range)`
  }
  return `${prefix}beyond half court`
}
