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
  return result.success ? normalizePlay(result.data as Play) : null
}

export function parsePlaybookFile(data: unknown): PlaybookFile | null {
  const result = playbookFileSchema.safeParse(data)
  if (!result.success) return null
  const doc = result.data as PlaybookFile
  return { ...doc, plays: doc.plays.map(normalizePlay) }
}

// ── Sanitisation (second line of defence behind the zod schemas) ────────────

/** Record keys that collide with Object internals (prototype pollution). */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"])

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,40}$/

/** Ids safe to use as object keys and stable across export/import. */
export function isSafeId(id: string): boolean {
  return SAFE_ID_RE.test(id) && !DANGEROUS_KEYS.has(id)
}

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029]/g
/** Zero-width, bidi-override and BOM characters used to disguise text. */
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g

/** Strips control / zero-width / bidi-override characters from text that a
 * third-party file or an LLM can put on screen (names, notes, labels). */
export function sanitizeText(input: string, opts?: { multiline?: boolean }): string {
  const cleaned = input
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE_RE, "")
    .replace(CONTROL_CHARS_RE, " ")
  const flat = opts?.multiline ? cleaned : cleaned.replace(/[\n\t]+/g, " ")
  return flat.trim()
}

/** Only same-origin paths or http(s) URLs; anything else becomes null. */
function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 500)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed.slice(0, 500)
  return null
}

/**
 * Normalises a schema-valid play from an untrusted source (file import, LLM
 * output, request body): dedupes element ids, remaps ids that could collide
 * with Object internals, drops positions/actions that reference unknown
 * elements and sanitises every string field.
 */
export function normalizePlay(play: Play): Play {
  const idMap = new Map<string, string>()
  const elements: PlayElement[] = []
  for (const el of play.elements) {
    if (idMap.has(el.id)) continue // duplicate id — keep the first token only
    const id = isSafeId(el.id) ? el.id : newId()
    idMap.set(el.id, id)
    elements.push({
      id,
      kind: el.kind,
      label: sanitizeText(el.label).slice(0, 24),
      player: el.player
        ? {
            slug: sanitizeText(el.player.slug).slice(0, 120),
            name: sanitizeText(el.player.name).slice(0, 160),
            position: el.player.position
              ? sanitizeText(el.player.position).slice(0, 40)
              : null,
            imageUrl: safeImageUrl(el.player.imageUrl),
          }
        : (el.player ?? null),
    })
  }

  const frames: PlayFrame[] = play.frames.map((f) => {
    const positions: Record<string, Point> = {}
    for (const [rawId, p] of Object.entries(f.positions)) {
      const id = idMap.get(rawId)
      if (!id) continue
      positions[id] = { x: p.x, y: p.y }
    }
    const seenActionIds = new Set<string>()
    const actions: PlayAction[] = []
    for (const a of f.actions) {
      const elementId = idMap.get(a.elementId)
      if (!elementId) continue
      const id = isSafeId(a.id) && !seenActionIds.has(a.id) ? a.id : newId()
      seenActionIds.add(id)
      const targetElementId = a.targetElementId
        ? (idMap.get(a.targetElementId) ?? null)
        : (a.targetElementId ?? null)
      actions.push({
        id,
        type: a.type,
        elementId,
        targetElementId,
        via: a.via ? { x: a.via.x, y: a.via.y } : null,
      })
    }
    const note = f.note
      ? sanitizeText(f.note, { multiline: true }).slice(0, MAX_NOTE_LEN)
      : ""
    return {
      id: isSafeId(f.id) ? f.id : newId(),
      positions,
      actions,
      note: note || undefined,
    }
  })

  const description = play.description
    ? sanitizeText(play.description, { multiline: true }).slice(0, MAX_DESCRIPTION_LEN)
    : ""

  return {
    id: isSafeId(play.id) ? play.id : newId(),
    name: sanitizeText(play.name).slice(0, MAX_NAME_LEN) || "Play",
    description: description || undefined,
    courtType: play.courtType,
    team: play.team
      ? {
          slug: sanitizeText(play.team.slug).slice(0, 120),
          name: sanitizeText(play.team.name).slice(0, 160),
          leagueSlug: sanitizeText(play.team.leagueSlug).slice(0, 60),
        }
      : (play.team ?? null),
    elements,
    frames,
    createdAt: sanitizeText(play.createdAt).slice(0, 40),
    updatedAt: sanitizeText(play.updatedAt).slice(0, 40),
  }
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

// ── Templates ────────────────────────────────────────────────────────────────

export type PlayTemplate = {
  id: string
  name: string
  description: string
  category: "offense" | "defense" | "transition" | "sideline" | "baseline"
  create: () => Play
}

function templateIds() {
  return {
    p1: newId(), p2: newId(), p3: newId(), p4: newId(), p5: newId(), ball: newId(),
  }
}

function fiveOut(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 1.2, y: 1.6 },
      [ids.p5]: { x: 13.8, y: 1.6 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [{ id: newId(), type: "cut", elementId: ids.p2, via: { x: 4, y: 5 } }],
    note: "2 cuts to the top, 1 reverses the ball",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 8.5, y: 10.8 }, [ids.p2]: { x: 7.5, y: 6.5 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 1.2, y: 1.6 },
      [ids.p5]: { x: 13.8, y: 1.6 }, [ids.ball]: { x: 8.8, y: 10.5 },
    }, actions: [{ id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null }],
    note: "1 hits 2 at the top of the key",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 5 }, [ids.p2]: { x: 7.5, y: 6.5 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 1.2, y: 1.6 },
      [ids.p5]: { x: 13.8, y: 1.6 }, [ids.ball]: { x: 7.9, y: 6.8 },
    }, actions: [], note: "1 cuts to the weak side, spacing maintained",
  }]
}

function spreadPickRoll(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 5.05, y: 3.5 },
      [ids.p5]: { x: 9.95, y: 3.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [{ id: newId(), type: "screen", elementId: ids.p5, via: null }],
    note: "5 sets a high ball screen, 2 & 3 spaced in the corners",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 7.5 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 5.05, y: 3.5 },
      [ids.p5]: { x: 9, y: 9.5 }, [ids.ball]: { x: 11.35, y: 7.5 },
    }, actions: [{ id: newId(), type: "cut", elementId: ids.p5, via: { x: 9.5, y: 6 } }],
    note: "1 rejects the screen and attacks middle, 5 rolls",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 7.5 }, [ids.p2]: { x: 5, y: 3.5 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 5.05, y: 3.5 },
      [ids.p5]: { x: 8.2, y: 2.3 }, [ids.ball]: { x: 8.55, y: 2.3 },
    }, actions: [], note: "Pocket pass to the roller for a finish",
  }]
}

function flexAction(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.5, y: 9 },
      [ids.p3]: { x: 12.5, y: 9 }, [ids.p4]: { x: 4, y: 2.5 },
      [ids.p5]: { x: 11, y: 2.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null },
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
    ], note: "1 passes to 2, 5 sets the flex screen for 4",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 9.5 }, [ids.p2]: { x: 2.5, y: 9 },
      [ids.p3]: { x: 12.5, y: 9 }, [ids.p4]: { x: 7.5, y: 2.8 },
      [ids.p5]: { x: 11, y: 2.5 }, [ids.ball]: { x: 2.9, y: 9.3 },
    }, actions: [{ id: newId(), type: "pass", elementId: ids.p2, targetElementId: ids.p4, via: null }],
    note: "4 cuts off the flex screen, 2 hits the curl",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 9.5 }, [ids.p2]: { x: 2.5, y: 9 },
      [ids.p3]: { x: 12.5, y: 9 }, [ids.p4]: { x: 7.5, y: 2.8 },
      [ids.p5]: { x: 11, y: 2.5 }, [ids.ball]: { x: 7.9, y: 3.1 },
    }, actions: [], note: "4 turns and scores or kicks to the weak side",
  }]
}

function zoneOffense(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 3.5, y: 9 },
      [ids.p3]: { x: 11.5, y: 9 }, [ids.p4]: { x: 5.5, y: 3.8 },
      [ids.p5]: { x: 11, y: 3.8 }, [ids.ball]: { x: 7.9, y: 11.3 },
    }, actions: [{ id: newId(), type: "dribble", elementId: ids.p1, via: { x: 5.5, y: 10 } }],
    note: "1 dribbles into the seam, drawing two defenders",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 5.5, y: 9.5 }, [ids.p2]: { x: 3.5, y: 9 },
      [ids.p3]: { x: 11.5, y: 9 }, [ids.p4]: { x: 5.5, y: 3.8 },
      [ids.p5]: { x: 11, y: 3.8 }, [ids.ball]: { x: 5.9, y: 9.3 },
    }, actions: [{ id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p4, via: null }],
    note: "Skip pass to 4 in the short corner",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 5.5, y: 9.5 }, [ids.p2]: { x: 3.5, y: 9 },
      [ids.p3]: { x: 11.5, y: 9 }, [ids.p4]: { x: 5.5, y: 3.8 },
      [ids.p5]: { x: 11, y: 3.8 }, [ids.ball]: { x: 5.9, y: 3.5 },
    }, actions: [], note: "4 attacks the closeout or kicks to 5 for a corner three",
  }]
}

function motionStrong(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 7.5, y: 4.5 },
      [ids.p5]: { x: 11.5, y: 2.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p4, via: null },
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
    ], note: "1 passes to 4 at the elbow, 5 sets down screen for 3",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 12, y: 10 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 2.5 }, [ids.p4]: { x: 7.5, y: 4.5 },
      [ids.p5]: { x: 3, y: 4 }, [ids.ball]: { x: 7.9, y: 4.8 },
    }, actions: [{ id: newId(), type: "dribble", elementId: ids.p4, via: { x: 5.5, y: 3.5 } }],
    note: "3 curls off the screen, 4 drives baseline",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 12, y: 10 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 2.5 }, [ids.p4]: { x: 4, y: 2.5 },
      [ids.p5]: { x: 3, y: 4 }, [ids.ball]: { x: 4.4, y: 2.8 },
    }, actions: [], note: "Kick to 3 in the corner for the shot",
  }]
}

function slobAction(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7, y: 12.5 }, [ids.p2]: { x: 2, y: 13.5 },
      [ids.p3]: { x: 13, y: 6 }, [ids.p4]: { x: 7.5, y: 5 },
      [ids.p5]: { x: 3.5, y: 4 }, [ids.ball]: { x: 2.3, y: 13.5 },
    }, actions: [
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
      { id: newId(), type: "cut", elementId: ids.p3, via: { x: 12, y: 2 } },
    ], note: "5 screens for 3 who cuts to the ball",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 7, y: 12.5 }, [ids.p2]: { x: 2, y: 13.5 },
      [ids.p3]: { x: 5, y: 4 }, [ids.p4]: { x: 7.5, y: 5 },
      [ids.p5]: { x: 3.5, y: 4 }, [ids.ball]: { x: 2.3, y: 13.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p2, targetElementId: ids.p3, via: null },
      { id: newId(), type: "screen", elementId: ids.p4, via: null },
    ], note: "2 hits 3 curling off the screen, 4 sets back screen for 5",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 7, y: 12.5 }, [ids.p2]: { x: 10, y: 10 },
      [ids.p3]: { x: 5, y: 4 }, [ids.p4]: { x: 2, y: 3.5 },
      [ids.p5]: { x: 7, y: 2.5 }, [ids.ball]: { x: 5.4, y: 4.3 },
    }, actions: [], note: "3 looks for the shot or the lob to 5 rolling",
  }]
}

function spainPnr(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 9.95, y: 5.8 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
    ], note: "5 sets ball screen for 1; 4 prepares to back-screen the roller",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 7.6 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 8.6, y: 9.4 }, [ids.ball]: { x: 11.35, y: 7.5 },
    }, actions: [
      { id: newId(), type: "screen", elementId: ids.p4, targetElementId: ids.p5, via: null },
    ], note: "4 back-screens for 5 (Spain action); 1 reads the coverage",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 7.6 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 8.2, y: 2.6 },
      [ids.p5]: { x: 7.5, y: 10.8 }, [ids.ball]: { x: 11.35, y: 7.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p5, via: null },
    ], note: "Pocket pass to the popper (4) or lob to the roller (5)",
  }]
}

function chicagoAction(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 9.95, y: 5.8 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p3, via: null },
    ], note: "1 swings to 3 on the wing",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 5, y: 10 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 9.95, y: 5.8 }, [ids.ball]: { x: 12.9, y: 9.8 },
    }, actions: [
      { id: newId(), type: "handoff", elementId: ids.p3, targetElementId: ids.p1, via: null },
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
    ], note: "3 reverses to 1 off the DHO; 5 sets the ball screen",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 11, y: 7.6 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 10.5, y: 10 }, [ids.p4]: { x: 5.05, y: 3.5 },
      [ids.p5]: { x: 8.6, y: 9.4 }, [ids.ball]: { x: 11.35, y: 7.5 },
    }, actions: [
      { id: newId(), type: "screen", elementId: ids.p4, targetElementId: ids.p5, via: null },
    ], note: "Chicago action: 4 back-screens for 5 (the roller)",
  }]
}

function zipperSlice(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 7.5, y: 5.8 },
      [ids.p5]: { x: 11, y: 5.8 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p2, via: { x: 5, y: 10 } },
    ], note: "2 zipper cuts to the top off 4's screen",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 3, y: 10 }, [ids.p2]: { x: 7.5, y: 6.5 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 7.5, y: 5.8 },
      [ids.p5]: { x: 11, y: 5.8 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p2, targetElementId: ids.p5, via: null },
      { id: newId(), type: "cut", elementId: ids.p4, via: { x: 5, y: 3 } },
    ], note: "2 hits 5 in the post; 4 slices to the basket",
  }]
}

function iversonCut(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 3, y: 9.6 },
      [ids.p3]: { x: 12, y: 9.6 }, [ids.p4]: { x: 7.5, y: 4.5 },
      [ids.p5]: { x: 9.5, y: 2.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p3, via: { x: 10, y: 6 } },
    ], note: "3 cuts across the top off a double screen from 4 & 5 (Iverson cut)",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 3, y: 9.6 },
      [ids.p3]: { x: 11, y: 6 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 9.5, y: 2.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p3, via: null },
    ], note: "1 passes to 3 at the wing for a shot or drive",
  }]
}

function floppyAction(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 3, y: 5.8 },
      [ids.p3]: { x: 12, y: 5.8 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 9.5, y: 4.5 }, [ids.ball]: { x: 8.2, y: 11.5 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p2, via: { x: 5, y: 8 } },
    ], note: "2 flares off 4's down-screen (floppy look)",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 9.5, y: 4.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null },
    ], note: "1 hits 2 on the wing for the shot",
  }]
}

function hammerSet(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 13.5, y: 5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "dribble", elementId: ids.p1, via: { x: 11, y: 10 } },
    ], note: "1 drives baseline, drawing help from the weak side",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 12.5, y: 8 }, [ids.p2]: { x: 5, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 9, y: 2.5 },
      [ids.p5]: { x: 13.5, y: 5 }, [ids.ball]: { x: 12.8, y: 7.8 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null },
    ], note: "Skip pass to 2 in the corner (hammer action via 4's pin-down)",
  }]
}

function uclaCut(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 9.5, y: 4.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p3, via: null },
    ], note: "1 passes to 3 on the wing",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 4, y: 8 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 9.5, y: 4.5 }, [ids.ball]: { x: 12.9, y: 9.8 },
    }, actions: [
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
      { id: newId(), type: "cut", elementId: ids.p1, via: { x: 7.5, y: 6 } },
    ], note: "1 cuts to the basket off 5's UCLA screen at the high post",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 6, y: 2 }, [ids.p2]: { x: 2.4, y: 9.6 },
      [ids.p3]: { x: 12.6, y: 9.6 }, [ids.p4]: { x: 5.5, y: 4.5 },
      [ids.p5]: { x: 7.5, y: 5.8 }, [ids.ball]: { x: 12.9, y: 9.8 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p3, targetElementId: ids.p1, via: null },
    ], note: "3 hits 1 cutting to the rim for the layup",
  }]
}

// ── Defense template generators ───────────────────────────────────
function zone23(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 10.5 }, [ids.p2]: { x: 3, y: 8.5 },
      [ids.p3]: { x: 12, y: 8.5 }, [ids.p4]: { x: 5, y: 3 },
      [ids.p5]: { x: 10, y: 3 }, [ids.ball]: { x: 4.5, y: 9 },
    }, actions: [],
    note: "2-3 zone: guards at the top, wings in the corners, bigs on the blocks",
  }]
}

function zone32(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11 }, [ids.p2]: { x: 4, y: 9 },
      [ids.p3]: { x: 11, y: 9 }, [ids.p4]: { x: 7.5, y: 5 },
      [ids.p5]: { x: 7.5, y: 2.2 }, [ids.ball]: { x: 8, y: 10 },
    }, actions: [],
    note: "3-2 matchup: top 3 pressure the ball, bottom 2 patrol the paint",
  }]
}

function boxAnd1(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11 }, [ids.p2]: { x: 4, y: 5 },
      [ids.p3]: { x: 11, y: 5 }, [ids.p4]: { x: 5.5, y: 2.5 },
      [ids.p5]: { x: 9.5, y: 2.5 }, [ids.ball]: { x: 3, y: 9.5 },
    }, actions: [],
    note: "Box-and-1: X1 chases the star, X2-X5 zone the paint",
  }]
}

function trap131(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.5 }, [ids.p2]: { x: 4, y: 8.5 },
      [ids.p3]: { x: 11, y: 8.5 }, [ids.p4]: { x: 7.5, y: 5 },
      [ids.p5]: { x: 7.5, y: 2.2 }, [ids.ball]: { x: 2.5, y: 9 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p2, via: { x: 3.5, y: 9 } },
    ], note: "1-3-1 trap: X2 and X1 trap the ball on the wing, X4 covers the middle",
  }]
}

// ── Transition template generators ────────────────────────────────
function dragScreen(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 7.5, y: 10 },
      [ids.p5]: { x: 3, y: 8 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "screen", elementId: ids.p4, via: null },
    ], note: "4 drags up to set a high ball screen in transition",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 10, y: 8 }, [ids.p2]: { x: 2.4, y: 1.6 },
      [ids.p3]: { x: 12.6, y: 1.6 }, [ids.p4]: { x: 9.5, y: 10 },
      [ids.p5]: { x: 3, y: 8 }, [ids.ball]: { x: 10.35, y: 7.5 },
    }, actions: [
      { id: newId(), type: "dribble", elementId: ids.p1, via: { x: 8.5, y: 6 } },
    ], note: "1 attacks off the drag screen; 4 pops for the pick-and-pop",
  }]
}

function pitchAhead(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 3, y: 7 },
      [ids.p3]: { x: 12, y: 7 }, [ids.p4]: { x: 5, y: 3 },
      [ids.p5]: { x: 10, y: 3 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null },
    ], note: "1 pitches ahead to 2 sprinting the wing",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 9, y: 8 }, [ids.p2]: { x: 3, y: 7 },
      [ids.p3]: { x: 12, y: 7 }, [ids.p4]: { x: 5, y: 3 },
      [ids.p5]: { x: 10, y: 3 }, [ids.ball]: { x: 3.4, y: 7.3 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p3, via: { x: 10, y: 4 } },
    ], note: "2 attacks the closeout; 3 cuts to the rim",
  }]
}

function secondaryBreak(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 11.8 }, [ids.p2]: { x: 3, y: 8 },
      [ids.p3]: { x: 12, y: 8 }, [ids.p4]: { x: 7.5, y: 7 },
      [ids.p5]: { x: 7.5, y: 3.5 }, [ids.ball]: { x: 7.9, y: 11.5 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null },
    ], note: "Secondary break: 1 hits 2 on the wing, 4 & 5 trail into horns",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 9, y: 9 }, [ids.p2]: { x: 3, y: 8 },
      [ids.p3]: { x: 12, y: 8 }, [ids.p4]: { x: 5.05, y: 5.8 },
      [ids.p5]: { x: 9.95, y: 5.8 }, [ids.ball]: { x: 3.4, y: 8.3 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p2, targetElementId: ids.p4, via: null },
    ], note: "Ball reversal to 4 at the elbow starts the horns set",
  }]
}

// ── Baseline out-of-bounds template generators ────────────────────
function blobBox(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 12.5 }, [ids.p2]: { x: 4, y: 4.5 },
      [ids.p3]: { x: 11, y: 4.5 }, [ids.p4]: { x: 5.5, y: 2.5 },
      [ids.p5]: { x: 9.5, y: 2.5 }, [ids.ball]: { x: 7.5, y: 0.5 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p2, via: { x: 3, y: 7 } },
      { id: newId(), type: "screen", elementId: ids.p5, via: null },
    ], note: "Box set: 2 curls off 5's screen, 4 opens up for the skip",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 12.5 }, [ids.p2]: { x: 5, y: 6 },
      [ids.p3]: { x: 11, y: 4.5 }, [ids.p4]: { x: 7.5, y: 2.5 },
      [ids.p5]: { x: 9.5, y: 2.5 }, [ids.ball]: { x: 5.4, y: 6.3 },
    }, actions: [], note: "1 hits 2 for the catch-and-shoot or attack",
  }]
}

function blobStack(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 12.5 }, [ids.p2]: { x: 7.5, y: 3.5 },
      [ids.p3]: { x: 7.5, y: 2.5 }, [ids.p4]: { x: 7.5, y: 1.5 },
      [ids.p5]: { x: 7.5, y: 0.5 }, [ids.ball]: { x: 13, y: 1 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p3, via: { x: 3, y: 5 } },
    ], note: "Stack: 3 curls to the ball off 4 & 5's screens",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 9, y: 12 }, [ids.p2]: { x: 7.5, y: 3.5 },
      [ids.p3]: { x: 5, y: 6 }, [ids.p4]: { x: 7.5, y: 1.5 },
      [ids.p5]: { x: 7.5, y: 0.5 }, [ids.ball]: { x: 5.4, y: 6.3 },
    }, actions: [], note: "1 hits 3 for the immediate jumper or drive",
  }]
}

function blobLob(now: string, ids: ReturnType<typeof templateIds>): PlayFrame[] {
  return [{
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 12.5 }, [ids.p2]: { x: 5.5, y: 2.5 },
      [ids.p3]: { x: 9.5, y: 2.5 }, [ids.p4]: { x: 5, y: 5.5 },
      [ids.p5]: { x: 10, y: 5.5 }, [ids.ball]: { x: 7.5, y: 0.5 },
    }, actions: [
      { id: newId(), type: "cut", elementId: ids.p2, via: { x: 5, y: 4 } },
    ], note: "Lob set: 2 cuts backdoor, 5 screens the defender",
  }, {
    id: newId(), positions: {
      [ids.p1]: { x: 7.5, y: 12.5 }, [ids.p2]: { x: 6.5, y: 1.2 },
      [ids.p3]: { x: 9.5, y: 2.5 }, [ids.p4]: { x: 5, y: 5.5 },
      [ids.p5]: { x: 10, y: 5.5 }, [ids.ball]: { x: 7.5, y: 4 },
    }, actions: [
      { id: newId(), type: "pass", elementId: ids.p1, targetElementId: ids.p2, via: null },
    ], note: "Lob pass to 2 cutting to the rim for the alley-oop",
  }]
}

export const PLAY_TEMPLATES: PlayTemplate[] = [
  {
    id: "horns", name: "Horns Ball Screen", category: "offense",
    description: "Classic horns set with a ball screen and roll to the rim.",
    create: () => createSamplePlay(),
  },
  {
    id: "five-out", name: "5-Out Motion", category: "offense",
    description: "Wide spacing with five perimeter players, constant cutting.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "5-Out Motion", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: fiveOut(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "pnr-spread", name: "Spread Pick & Roll", category: "offense",
    description: "Modern spread P&R with shooters in the corners.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Spread Pick & Roll", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: spreadPickRoll(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "flex", name: "Flex Offense", category: "offense",
    description: "Classic flex screen action with a curl to the rim.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Flex Offense", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: flexAction(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "zone-offense", name: "1-3-1 Zone Offense", category: "offense",
    description: "Attack a 2-3 zone by splitting the defense through the seam.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "1-3-1 Zone Offense", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: zoneOffense(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "motion-strong", name: "Motion Strong", category: "offense",
    description: "4-out 1-in motion with a down screen and drive.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Motion Strong", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: motionStrong(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "slob", name: "SLOB — Side Out", category: "sideline",
    description: "Side out of bounds play with screens and a lob option.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "SLOB — Side Out", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: slobAction(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  // ── Additional high-level templates ─────────────────────────────
  {
    id: "spain-pnr", name: "Spain Pick & Roll", category: "offense",
    description: "Ball screen + back-screen for the roller (Spain action). EuroLeague staple.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Spain Pick & Roll", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: spainPnr(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "chicago", name: "Chicago Action", category: "offense",
    description: "Side P&R with a back-screen on the roller's defender. NBA favorite (Thibodeau).",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Chicago Action", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: chicagoAction(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "zipper-slice", name: "Zipper Slice", category: "offense",
    description: "Zipper entry into a slice cut. Used by Real Madrid and many EuroLeague teams.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Zipper Slice", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: zipperSlice(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "iverson-cut", name: "Iverson Cut", category: "offense",
    description: "Famous Georgetown/Pistons cross-screen for a guard — pinch-post option.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Iverson Cut", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: iversonCut(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "floppy", name: "Floppy Action", category: "offense",
    description: "Double down-screen for a shooter. NBA staple (Spoelstra, Kerr).",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Floppy Action", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: floppyAction(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "hammer", name: "Hammer Set", category: "offense",
    description: "Weak-side pin-down screen for a corner three. Used by the Warriors and Spurs.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Hammer Set", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: hammerSet(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "ucla-cut", name: "UCLA Cut", category: "offense",
    description: "Guard passes to the wing and cuts off a high-post screen. Classic John Wooden.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "UCLA Cut", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: uclaCut(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  // ── Defense ─────────────────────────────────────────────────────
  {
    id: "zone-2-3", name: "2-3 Zone Defense", category: "defense",
    description: "Traditional 2-3 zone with rotations and closeout responsibilities.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "2-3 Zone Defense", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "defender" as const, label: "1" }, { id: ids.p2, kind: "defender" as const, label: "2" },
          { id: ids.p3, kind: "defender" as const, label: "3" }, { id: ids.p4, kind: "defender" as const, label: "4" },
          { id: ids.p5, kind: "defender" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: zone23(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "zone-3-2", name: "3-2 Matchup Zone", category: "defense",
    description: "3-2 match-up zone that can switch to man principles. NCAA favourite.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "3-2 Matchup Zone", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "defender" as const, label: "1" }, { id: ids.p2, kind: "defender" as const, label: "2" },
          { id: ids.p3, kind: "defender" as const, label: "3" }, { id: ids.p4, kind: "defender" as const, label: "4" },
          { id: ids.p5, kind: "defender" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: zone32(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "box-and-1", name: "Box-and-1", category: "defense",
    description: "Box zone with a chaser on the opposing star. Used vs elite scorers.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Box-and-1", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "defender" as const, label: "1" }, { id: ids.p2, kind: "defender" as const, label: "2" },
          { id: ids.p3, kind: "defender" as const, label: "3" }, { id: ids.p4, kind: "defender" as const, label: "4" },
          { id: ids.p5, kind: "defender" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: boxAnd1(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "1-3-1-trap", name: "1-3-1 Halfcourt Trap", category: "defense",
    description: "1-3-1 trapping defense that pressures the wings and forces turnovers.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "1-3-1 Halfcourt Trap", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "defender" as const, label: "1" }, { id: ids.p2, kind: "defender" as const, label: "2" },
          { id: ids.p3, kind: "defender" as const, label: "3" }, { id: ids.p4, kind: "defender" as const, label: "4" },
          { id: ids.p5, kind: "defender" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: trap131(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  // ── Transition ──────────────────────────────────────────────────
  {
    id: "drag-screen", name: "Drag Screen Transition", category: "transition",
    description: "Big sets a high ball screen in early offence before the defense sets.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Drag Screen Transition", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: dragScreen(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "pitch-ahead", name: "Pitch Ahead", category: "transition",
    description: "Outlet pass to the wing for an immediate attack. USA Basketball staple.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Pitch Ahead", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: pitchAhead(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "secondary-break", name: "Secondary Break", category: "transition",
    description: "Flow into a horns set after the primary fast break is stopped.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "Secondary Break", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: secondaryBreak(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  // ── Baseline out of bounds ──────────────────────────────────────
  {
    id: "blob-box", name: "BLOB — Box Set", category: "baseline",
    description: "Baseline out of bounds with a box set. Multiple options: lob, skip, curl.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "BLOB — Box Set", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: blobBox(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "blob-stack", name: "BLOB — Stack", category: "baseline",
    description: "Stack alignment on the baseline. Quick hitter for a lob or a curl three.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "BLOB — Stack", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: blobStack(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
  {
    id: "blob-lob", name: "BLOB — Lob", category: "baseline",
    description: "Alley-oop lob from under the basket. High-low action vs pressure.",
    create: () => {
      const now = new Date().toISOString()
      const ids = templateIds()
      return { id: newId(), name: "BLOB — Lob", courtType: "half" as const,
        elements: [
          { id: ids.p1, kind: "attacker" as const, label: "1" }, { id: ids.p2, kind: "attacker" as const, label: "2" },
          { id: ids.p3, kind: "attacker" as const, label: "3" }, { id: ids.p4, kind: "attacker" as const, label: "4" },
          { id: ids.p5, kind: "attacker" as const, label: "5" }, { id: ids.ball, kind: "ball" as const, label: "" },
        ],
        frames: blobLob(now, ids), createdAt: now, updatedAt: now,
      }
    },
  },
]
