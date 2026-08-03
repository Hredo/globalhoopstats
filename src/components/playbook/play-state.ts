"use client"

import { useReducer } from "react"
import {
  clampToCourt,
  distance,
  mirrorX,
  nearestRim,
} from "@/lib/playbook/geometry"
import {
  newId,
  nextLabel,
  sanitizeText,
  type ActionType,
  type CourtType,
  type ElementKind,
  type LinkedPlayer,
  type Play,
  type PlayAction,
  type PlayDrawing,
  type PlayElement,
  type PlayFrame,
  type Point,
  MAX_DRAWING_POINTS,
  MAX_DRAWINGS_PER_FRAME,
  MAX_ELEMENTS,
  MAX_FRAMES,
  MAX_LABEL_LEN,
} from "@/lib/playbook/types"

/**
 * Editor state machine for a single play: current frame, selection and a
 * bounded undo/redo history. Drags stream `*Live` updates (no history entry);
 * the editor dispatches `beginGesture` once on pointer-down so the whole drag
 * undoes as one step.
 */

const HISTORY_CAP = 60
/** Ball snaps to a hand when this close to a player (metres). */
const BALL_GRAB_RADIUS = 1.0
const BALL_OFFSET: Point = { x: 0.42, y: -0.1 }

/** Actions that send the ball somewhere rather than move the player. */
export function isBallAction(type: ActionType): boolean {
  return type === "pass" || type === "handoff" || type === "shot"
}

export type EditorState = {
  play: Play
  frameIdx: number
  selectedElementId: string | null
  selectedActionId: string | null
  past: Play[]
  future: Play[]
  /** Bumped on every user edit; the shell uses it for the "unsaved" dot. */
  dirty: number
}

type Action =
  | { type: "replace-play"; play: Play }
  | { type: "begin-gesture" }
  | { type: "move-live"; elementId: string; point: Point }
  | { type: "via-live"; actionId: string; via: Point }
  | { type: "move-next-live"; elementId: string; point: Point }
  | {
      type: "add-element"
      kind: ElementKind
      at: Point
      player?: LinkedPlayer | null
      /** Free text for `text` markers; players auto-number without it. */
      label?: string
    }
  | { type: "remove-element"; elementId: string }
  | { type: "assign-player"; elementId: string; player: LinkedPlayer | null }
  | {
      type: "add-movement"
      elementId: string
      actionType: ActionType
      to: Point
      targetElementId?: string | null
    }
  | { type: "remove-action"; actionId: string }
  | { type: "set-element-label"; elementId: string; label: string }
  | { type: "add-drawing"; points: Point[] }
  | { type: "remove-drawing"; drawingId: string }
  | { type: "clear-drawings" }
  | { type: "flip-horizontal" }
  | { type: "add-frame" }
  | { type: "remove-frame" }
  | { type: "set-frame-idx"; frameIdx: number }
  | { type: "set-frame-note"; note: string }
  | { type: "set-name"; name: string }
  | { type: "set-description"; description: string }
  | { type: "set-court"; courtType: CourtType }
  | { type: "set-team"; team: Play["team"] }
  | { type: "select-element"; elementId: string | null }
  | { type: "select-action"; actionId: string | null }
  | { type: "undo" }
  | { type: "redo" }

function touch(play: Play): Play {
  return { ...play, updatedAt: new Date().toISOString() }
}

function pushHistory(state: EditorState, nextPlay: Play): EditorState {
  return {
    ...state,
    past: [...state.past.slice(-HISTORY_CAP + 1), state.play],
    future: [],
    play: touch(nextPlay),
    dirty: state.dirty + 1,
  }
}

/** Mutates the play without a history entry (live drag frames). */
function liveUpdate(state: EditorState, nextPlay: Play): EditorState {
  return { ...state, play: touch(nextPlay), dirty: state.dirty + 1 }
}

function updateFrame(play: Play, frameIdx: number, fn: (f: PlayFrame) => PlayFrame): Play {
  return {
    ...play,
    frames: play.frames.map((f, i) => (i === frameIdx ? fn(f) : f)),
  }
}

function findBall(play: Play): PlayElement | undefined {
  return play.elements.find((e) => e.kind === "ball")
}

/** The attacker currently holding the ball in a frame, if any. */
export function ballHolderId(play: Play, frame: PlayFrame): string | null {
  if (!frame) return null
  const ball = findBall(play)
  if (!ball) return null
  const ballPos = frame.positions[ball.id]
  if (!ballPos) return null
  let best: { id: string; d: number } | null = null
  for (const el of play.elements) {
    if (el.kind !== "attacker") continue
    const pos = frame.positions[el.id]
    if (!pos) continue
    const d = distance(pos, ballPos)
    if (d <= BALL_GRAB_RADIUS && (!best || d < best.d)) best = { id: el.id, d }
  }
  return best?.id ?? null
}

function reducer(state: EditorState, action: Action): EditorState {
  const { play, frameIdx } = state
  const frame = play.frames[frameIdx]

  switch (action.type) {
    case "replace-play": {
      return {
        play: action.play,
        frameIdx: 0,
        selectedElementId: null,
        selectedActionId: null,
        past: [],
        future: [],
        dirty: 0,
      }
    }

    case "begin-gesture":
      return {
        ...state,
        past: [...state.past.slice(-HISTORY_CAP + 1), state.play],
        future: [],
      }

    case "move-live": {
      const point = clampToCourt(action.point, play.courtType)
      return liveUpdate(
        state,
        updateFrame(play, frameIdx, (f) => ({
          ...f,
          positions: { ...f.positions, [action.elementId]: point },
        })),
      )
    }

    case "via-live": {
      return liveUpdate(
        state,
        updateFrame(play, frameIdx, (f) => ({
          ...f,
          actions: f.actions.map((a) =>
            a.id === action.actionId ? { ...a, via: action.via } : a,
          ),
        })),
      )
    }

    case "move-next-live": {
      const nextFrameIdx = frameIdx + 1
      if (nextFrameIdx >= play.frames.length) return state
      const point = clampToCourt(action.point, play.courtType)
      return liveUpdate(
        state,
        updateFrame(play, nextFrameIdx, (f) => ({
          ...f,
          positions: { ...f.positions, [action.elementId]: point },
        })),
      )
    }

    case "add-element": {
      if (play.elements.length >= MAX_ELEMENTS) return state
      const at = clampToCourt(action.at, play.courtType)
      const label =
        action.kind === "attacker" || action.kind === "defender"
          ? nextLabel(play.elements, action.kind)
          : sanitizeText(action.label ?? "").slice(0, MAX_LABEL_LEN)
      const el: PlayElement = {
        id: newId(),
        kind: action.kind,
        label,
        player: action.player ?? null,
      }
      const next: Play = {
        ...play,
        elements: [...play.elements, el],
        // The element exists in every frame so scrubbing never loses it.
        frames: play.frames.map((f) => ({
          ...f,
          positions: { ...f.positions, [el.id]: at },
        })),
      }
      return {
        ...pushHistory(state, next),
        selectedElementId: el.id,
        selectedActionId: null,
      }
    }

    case "remove-element": {
      const next: Play = {
        ...play,
        elements: play.elements.filter((e) => e.id !== action.elementId),
        frames: play.frames.map((f) => {
          const positions = { ...f.positions }
          delete positions[action.elementId]
          return {
            ...f,
            positions,
            actions: f.actions.filter(
              (a) =>
                a.elementId !== action.elementId &&
                a.targetElementId !== action.elementId,
            ),
          }
        }),
      }
      return {
        ...pushHistory(state, next),
        selectedElementId:
          state.selectedElementId === action.elementId
            ? null
            : state.selectedElementId,
      }
    }

    case "assign-player": {
      const next: Play = {
        ...play,
        elements: play.elements.map((e) =>
          e.id === action.elementId ? { ...e, player: action.player } : e,
        ),
      }
      return pushHistory(state, next)
    }

    case "add-movement": {
      const to = clampToCourt(action.to, play.courtType)
      const ballAction = isBallAction(action.actionType)
      const isShot = action.actionType === "shot"
      // Pass / handoff need someone to catch it; a shot goes to the rim.
      if (ballAction && !isShot && !action.targetElementId) return state

      let next = play
      let nextFrameIdx = frameIdx + 1
      // Drawing a movement on the last frame grows the play by one step.
      if (nextFrameIdx >= play.frames.length) {
        if (play.frames.length >= MAX_FRAMES) return state
        next = {
          ...next,
          frames: [
            ...next.frames,
            { id: newId(), positions: { ...frame.positions }, actions: [] },
          ],
        }
      }

      const ball = findBall(next)
      const holder = ballHolderId(next, frame)

      next = updateFrame(next, nextFrameIdx, (f) => {
        const positions = { ...f.positions }
        if (isShot) {
          // The ball ends at the rim the shooter was attacking.
          const shooter = frame.positions[action.elementId]
          if (ball && shooter) {
            positions[ball.id] = clampToCourt(
              nearestRim(shooter, play.courtType),
              play.courtType,
            )
          }
        } else if (ballAction) {
          // The ball flies to wherever the receiver ends up.
          if (ball && action.targetElementId) {
            const receiverEnd =
              positions[action.targetElementId] ??
              frame.positions[action.targetElementId]
            if (receiverEnd) {
              positions[ball.id] = clampToCourt(
                { x: receiverEnd.x + BALL_OFFSET.x, y: receiverEnd.y + BALL_OFFSET.y },
                play.courtType,
              )
            }
          }
        } else {
          positions[action.elementId] = to
          // A dribbling player carries the ball with them.
          if (
            action.actionType === "dribble" &&
            ball &&
            holder === action.elementId
          ) {
            positions[ball.id] = clampToCourt(
              { x: to.x + BALL_OFFSET.x, y: to.y + BALL_OFFSET.y },
              play.courtType,
            )
          }
        }
        return { ...f, positions }
      })

      const newAction: PlayAction = {
        id: newId(),
        type: action.actionType,
        elementId: action.elementId,
        targetElementId: action.targetElementId ?? null,
        via: null,
      }
      next = updateFrame(next, frameIdx, (f) => ({
        ...f,
        actions: [
          // One movement path and one ball action per element per transition.
          ...f.actions.filter((a) => {
            if (a.elementId !== action.elementId) return true
            return isBallAction(a.type) !== ballAction
          }),
          newAction,
        ],
      }))

      return {
        ...pushHistory(state, next),
        selectedActionId: newAction.id,
        selectedElementId: null,
      }
    }

    case "remove-action": {
      const next = updateFrame(play, frameIdx, (f) => ({
        ...f,
        actions: f.actions.filter((a) => a.id !== action.actionId),
      }))
      return {
        ...pushHistory(state, next),
        selectedActionId:
          state.selectedActionId === action.actionId
            ? null
            : state.selectedActionId,
      }
    }

    case "set-element-label": {
      const label = sanitizeText(action.label).slice(0, MAX_LABEL_LEN)
      const next: Play = {
        ...play,
        elements: play.elements.map((e) =>
          e.id === action.elementId ? { ...e, label } : e,
        ),
      }
      return pushHistory(state, next)
    }

    case "add-drawing": {
      const points = action.points
        .slice(0, MAX_DRAWING_POINTS)
        .map((p) => clampToCourt(p, play.courtType))
      if (points.length < 2) return state
      if ((frame.drawings?.length ?? 0) >= MAX_DRAWINGS_PER_FRAME) return state
      const stroke: PlayDrawing = { id: newId(), points }
      return pushHistory(
        state,
        updateFrame(play, frameIdx, (f) => ({
          ...f,
          drawings: [...(f.drawings ?? []), stroke],
        })),
      )
    }

    case "remove-drawing": {
      if (!frame.drawings?.some((d) => d.id === action.drawingId)) return state
      return pushHistory(
        state,
        updateFrame(play, frameIdx, (f) => {
          const drawings = (f.drawings ?? []).filter((d) => d.id !== action.drawingId)
          return { ...f, drawings: drawings.length > 0 ? drawings : undefined }
        }),
      )
    }

    case "clear-drawings": {
      if (!frame.drawings || frame.drawings.length === 0) return state
      return pushHistory(
        state,
        updateFrame(play, frameIdx, (f) => ({ ...f, drawings: undefined })),
      )
    }

    // "Run it to the other side" — mirrors the whole play across the centre
    // line, which is how coaches keep a left-side and right-side version.
    case "flip-horizontal": {
      const next: Play = {
        ...play,
        frames: play.frames.map((f) => {
          const positions: Record<string, Point> = {}
          for (const [id, p] of Object.entries(f.positions)) {
            positions[id] = clampToCourt(mirrorX(p), play.courtType)
          }
          return {
            ...f,
            positions,
            actions: f.actions.map((a) =>
              a.via ? { ...a, via: clampToCourt(mirrorX(a.via), play.courtType) } : a,
            ),
            drawings: f.drawings?.map((d) => ({
              ...d,
              points: d.points.map((p) => clampToCourt(mirrorX(p), play.courtType)),
            })),
          }
        }),
      }
      return pushHistory(state, next)
    }

    case "add-frame": {
      if (play.frames.length >= MAX_FRAMES) return state
      const copy: PlayFrame = {
        id: newId(),
        positions: { ...frame.positions },
        actions: [],
      }
      const frames = [...play.frames]
      frames.splice(frameIdx + 1, 0, copy)
      return {
        ...pushHistory(state, { ...play, frames }),
        frameIdx: frameIdx + 1,
        selectedActionId: null,
      }
    }

    case "remove-frame": {
      if (play.frames.length <= 1) return state
      const frames = play.frames.filter((_, i) => i !== frameIdx)
      return {
        ...pushHistory(state, { ...play, frames }),
        frameIdx: Math.min(frameIdx, frames.length - 1),
        selectedActionId: null,
      }
    }

    case "set-frame-idx": {
      const idx = Math.max(0, Math.min(play.frames.length - 1, action.frameIdx))
      return { ...state, frameIdx: idx, selectedActionId: null }
    }

    case "set-frame-note":
      return pushHistory(
        state,
        updateFrame(play, frameIdx, (f) => ({ ...f, note: action.note })),
      )

    case "set-name":
      return pushHistory(state, { ...play, name: action.name })

    case "set-description":
      return pushHistory(state, { ...play, description: action.description })

    case "set-court": {
      if (action.courtType === play.courtType) return state
      const next: Play = {
        ...play,
        courtType: action.courtType,
        frames: play.frames.map((f) => {
          const positions: Record<string, Point> = {}
          for (const [id, p] of Object.entries(f.positions)) {
            positions[id] = clampToCourt(p, action.courtType)
          }
          const actions = f.actions.map((a) =>
            a.via ? { ...a, via: clampToCourt(a.via, action.courtType) } : a,
          )
          return { ...f, positions, actions }
        }),
      }
      return pushHistory(state, next)
    }

    case "set-team":
      return pushHistory(state, { ...play, team: action.team })

    case "select-element":
      return {
        ...state,
        selectedElementId: action.elementId,
        selectedActionId: null,
      }

    case "select-action":
      return {
        ...state,
        selectedActionId: action.actionId,
        selectedElementId: null,
      }

    case "undo": {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return {
        ...state,
        play: prev,
        past: state.past.slice(0, -1),
        future: [state.play, ...state.future].slice(0, HISTORY_CAP),
        frameIdx: Math.min(state.frameIdx, prev.frames.length - 1),
        selectedElementId: null,
        selectedActionId: null,
        dirty: state.dirty + 1,
      }
    }

    case "redo": {
      const nextPlay = state.future[0]
      if (!nextPlay) return state
      return {
        ...state,
        play: nextPlay,
        past: [...state.past, state.play].slice(-HISTORY_CAP),
        future: state.future.slice(1),
        frameIdx: Math.min(state.frameIdx, nextPlay.frames.length - 1),
        selectedElementId: null,
        selectedActionId: null,
        dirty: state.dirty + 1,
      }
    }
  }
}

export function usePlayState(initial: Play) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    play: initial,
    frameIdx: 0,
    selectedElementId: null,
    selectedActionId: null,
    past: [],
    future: [],
    dirty: 0,
  }))

  // useReducer's dispatch identity is already stable across renders.
  return { state, dispatch }
}

export type PlayDispatch = (action: Action) => void
