import { z } from "zod"

/**
 * Playbook data model. A play is a sequence of frames; each frame is a full
 * snapshot of element positions plus the actions (cut / dribble / screen /
 * pass / handoff) performed while transitioning INTO the next frame. The
 * animation engine interpolates positions between consecutive frames along
 * each action's (optionally curved) path.
 *
 * Coordinates are FIBA metres: x ∈ [0, 15] across the court width, y ∈ [0, 14]
 * (half court, hoop at the top) or y ∈ [0, 28] (full court, second hoop at the
 * bottom). Storing metres keeps plays resolution-independent.
 */

export const COURT_WIDTH_M = 15
export const HALF_COURT_LENGTH_M = 14
export const FULL_COURT_LENGTH_M = 28

export type CourtType = "half" | "full"

export type Point = { x: number; y: number }

export type ElementKind = "attacker" | "defender" | "ball" | "cone" | "coach"

export type ActionType = "cut" | "dribble" | "screen" | "pass" | "handoff"

/** A real player from the database linked to a token on the court. */
export type LinkedPlayer = {
  slug: string
  name: string
  position: string | null
  imageUrl: string | null
}

export type PlayElement = {
  id: string
  kind: ElementKind
  /** "1".."5" for players, free text otherwise. */
  label: string
  player?: LinkedPlayer | null
}

export type PlayAction = {
  id: string
  type: ActionType
  /** The element performing the action (mover, or passer for passes). */
  elementId: string
  /** Pass / handoff / screen receiver. */
  targetElementId?: string | null
  /** Control point that curves the movement path (quadratic bézier). */
  via?: Point | null
}

export type PlayFrame = {
  id: string
  positions: Record<string, Point>
  actions: PlayAction[]
  note?: string
}

export type Play = {
  id: string
  name: string
  description?: string
  courtType: CourtType
  /** Team the play was designed for, if picked from the roster panel. */
  team?: { slug: string; name: string; leagueSlug: string } | null
  elements: PlayElement[]
  frames: PlayFrame[]
  createdAt: string
  updatedAt: string
}

/** The on-disk / exported document: one or many plays. */
export type PlaybookFile = {
  format: "ghs-playbook"
  version: 1
  exportedAt: string
  plays: Play[]
}

// ── Validation (shared by import UI and API routes) ─────────────────────────

export const MAX_ELEMENTS = 40
export const MAX_FRAMES = 48
export const MAX_ACTIONS_PER_FRAME = 40
export const MAX_NAME_LEN = 120
export const MAX_NOTE_LEN = 500
export const MAX_DESCRIPTION_LEN = 2000

const pointSchema = z.object({
  x: z.number().min(-5).max(COURT_WIDTH_M + 5),
  y: z.number().min(-5).max(FULL_COURT_LENGTH_M + 5),
})

const linkedPlayerSchema = z.object({
  slug: z.string().max(120),
  name: z.string().max(160),
  position: z.string().max(40).nullable(),
  imageUrl: z.string().max(500).nullable(),
})

const elementSchema = z.object({
  id: z.string().max(40),
  kind: z.enum(["attacker", "defender", "ball", "cone", "coach"]),
  label: z.string().max(24),
  player: linkedPlayerSchema.nullish(),
})

const actionSchema = z.object({
  id: z.string().max(40),
  type: z.enum(["cut", "dribble", "screen", "pass", "handoff"]),
  elementId: z.string().max(40),
  targetElementId: z.string().max(40).nullish(),
  via: pointSchema.nullish(),
})

const frameSchema = z.object({
  id: z.string().max(40),
  positions: z.record(z.string().max(40), pointSchema),
  actions: z.array(actionSchema).max(MAX_ACTIONS_PER_FRAME),
  note: z.string().max(MAX_NOTE_LEN).optional(),
})

export const playSchema = z.object({
  id: z.string().max(40),
  name: z.string().min(1).max(MAX_NAME_LEN),
  description: z.string().max(MAX_DESCRIPTION_LEN).optional(),
  courtType: z.enum(["half", "full"]),
  team: z
    .object({
      slug: z.string().max(120),
      name: z.string().max(160),
      leagueSlug: z.string().max(60),
    })
    .nullish(),
  elements: z.array(elementSchema).max(MAX_ELEMENTS),
  frames: z.array(frameSchema).min(1).max(MAX_FRAMES),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
})

export const playbookFileSchema = z.object({
  format: z.literal("ghs-playbook"),
  version: z.literal(1),
  exportedAt: z.string().max(40),
  plays: z.array(playSchema).min(1).max(200),
})

export function parsePlay(data: unknown): Play | null {
  const result = playSchema.safeParse(data)
  return result.success ? (result.data as Play) : null
}

export function parsePlaybookFile(data: unknown): PlaybookFile | null {
  const result = playbookFileSchema.safeParse(data)
  return result.success ? (result.data as PlaybookFile) : null
}

// ── Construction helpers ────────────────────────────────────────────────────

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function createEmptyPlay(name: string): Play {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name,
    courtType: "half",
    elements: [],
    frames: [{ id: newId(), positions: {}, actions: [] }],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * A ready-made "Horns" set so the editor never opens empty: the classic
 * 1-up-top, bigs-at-the-elbows alignment with a pass, a ball screen and a
 * roll to the rim across four frames. Doubles as living documentation of the
 * data model.
 */
export function createSamplePlay(name = "Horns — ball screen"): Play {
  const now = new Date().toISOString()
  const ids = {
    p1: newId(),
    p2: newId(),
    p3: newId(),
    p4: newId(),
    p5: newId(),
    ball: newId(),
  }
  const elements: PlayElement[] = [
    { id: ids.p1, kind: "attacker", label: "1" },
    { id: ids.p2, kind: "attacker", label: "2" },
    { id: ids.p3, kind: "attacker", label: "3" },
    { id: ids.p4, kind: "attacker", label: "4" },
    { id: ids.p5, kind: "attacker", label: "5" },
    { id: ids.ball, kind: "ball", label: "" },
  ]
  // Horns: 1 top, 4 & 5 at the elbows, 2 & 3 in the corners.
  const f1: PlayFrame = {
    id: newId(),
    positions: {
      [ids.p1]: { x: 7.5, y: 11.5 },
      [ids.p2]: { x: 1.2, y: 1.2 },
      [ids.p3]: { x: 13.8, y: 1.2 },
      [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 9.95, y: 5.8 },
      [ids.ball]: { x: 7.9, y: 11.3 },
    },
    actions: [
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
      { id: newId(), type: "dribble", elementId: ids.p1, via: { x: 10.2, y: 9.6 } },
    ],
    note: "5 sets the ball screen, 1 attacks off it",
  }
  const f2: PlayFrame = {
    id: newId(),
    positions: {
      [ids.p1]: { x: 11, y: 7.6 },
      [ids.p2]: { x: 1.2, y: 1.2 },
      [ids.p3]: { x: 13.8, y: 1.2 },
      [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 8.6, y: 9.4 },
      [ids.ball]: { x: 11.35, y: 7.5 },
    },
    actions: [
      { id: newId(), type: "cut", elementId: ids.p5, via: { x: 8.9, y: 6.2 } },
      { id: newId(), type: "cut", elementId: ids.p4, via: null },
    ],
    note: "5 rolls to the rim, 4 pops to the top",
  }
  const f3: PlayFrame = {
    id: newId(),
    positions: {
      [ids.p1]: { x: 11, y: 7.6 },
      [ids.p2]: { x: 1.2, y: 1.2 },
      [ids.p3]: { x: 13.8, y: 1.2 },
      [ids.p4]: { x: 7.5, y: 10.8 },
      [ids.p5]: { x: 8.2, y: 2.6 },
      [ids.ball]: { x: 11.35, y: 7.5 },
    },
    actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p5, via: null },
    ],
    note: "Pocket pass to the roller",
  }
  const f4: PlayFrame = {
    id: newId(),
    positions: {
      [ids.p1]: { x: 11, y: 7.6 },
      [ids.p2]: { x: 1.2, y: 1.2 },
      [ids.p3]: { x: 13.8, y: 1.2 },
      [ids.p4]: { x: 7.5, y: 10.8 },
      [ids.p5]: { x: 8.2, y: 2.6 },
      [ids.ball]: { x: 8.55, y: 2.55 },
    },
    actions: [],
    note: "5 finishes at the rim",
  }
  return {
    id: newId(),
    name,
    courtType: "half",
    elements,
    frames: [f1, f2, f3, f4],
    createdAt: now,
    updatedAt: now,
  }
}

/** Next free attacker/defender number 1-5, or null when the five are used. */
export function nextLabel(elements: PlayElement[], kind: "attacker" | "defender"): string {
  const used = new Set(
    elements.filter((e) => e.kind === kind).map((e) => e.label),
  )
  for (let n = 1; n <= 5; n++) {
    if (!used.has(String(n))) return String(n)
  }
  return String(elements.filter((e) => e.kind === kind).length + 1)
}
