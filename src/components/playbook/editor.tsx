"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import {
  COURT_WIDTH_M,
  type ActionType,
  type ElementKind,
  type LinkedPlayer,
  type Play,
  type PlayAction,
  type PlayElement,
  type PlayFrame,
  type Point,
} from "@/lib/playbook/types"
import {
  SCALE,
  courtLength,
  ctrlFromHandle,
  curveHandle,
  distance,
  dribblePathD,
  easeInOut,
  pathAngle,
  pathD,
  pathPoint,
} from "@/lib/playbook/geometry"
import { BOARD, PlaybookCourt } from "@/components/playbook/court"
import {
  ballHolderId,
  type EditorState,
  type PlayDispatch,
} from "@/components/playbook/play-state"

export type Tool =
  | "select"
  | "attacker"
  | "defender"
  | "ball"
  | "cone"
  | "coach"
  | "cut"
  | "dribble"
  | "screen"
  | "pass"
  | "handoff"
  | "erase"

const LINE_TOOLS: ReadonlySet<Tool> = new Set([
  "cut",
  "dribble",
  "screen",
  "pass",
  "handoff",
])
const ADD_TOOLS: ReadonlySet<Tool> = new Set([
  "attacker",
  "defender",
  "ball",
  "cone",
  "coach",
])

const TOKEN_R = 0.45
const BASE_TRANSITION_MS = 1200
export const PLAYER_DRAG_MIME = "application/x-ghs-player"

type DragState =
  | { mode: "element"; elementId: string }
  | { mode: "line"; elementId: string; from: Point }
  | { mode: "via"; actionId: string; from: Point; to: Point }

type Props = {
  state: EditorState
  dispatch: PlayDispatch
  svgRef: RefObject<SVGSVGElement | null>
}

export function PlayEditor({ state, dispatch, svgRef }: Props) {
  const t = useT()
  const { play, frameIdx, selectedElementId, selectedActionId } = state
  const frame = play.frames[frameIdx]
  const nextFrame = play.frames[frameIdx + 1]

  const [tool, setTool] = useState<Tool>("select")
  const [preview, setPreview] = useState<{ from: Point; to: Point } | null>(null)
  const dragRef = useRef<DragState | null>(null)

  // ── Playback ──────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0)

  const startPlayback = useCallback(() => {
    if (play.frames.length < 2) return
    setProgress(0)
    setPlaying(true)
    dispatch({ type: "select-element", elementId: null })
  }, [dispatch, play.frames.length])

  const stopPlayback = useCallback(
    (finalProgress?: number) => {
      setPlaying(false)
      const p = finalProgress ?? 0
      dispatch({ type: "set-frame-idx", frameIdx: Math.round(p) })
      setProgress(0)
    },
    [dispatch],
  )

  // Changing `speed` mid-play restarts the loop; progress lives in state so
  // playback simply continues from where it was.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const maxProgress = play.frames.length - 1
    const step = (now: number) => {
      const dt = now - last
      last = now
      setProgress((p) => {
        const next = p + (dt / BASE_TRANSITION_MS) * speed
        if (next >= maxProgress) {
          setPlaying(false)
          dispatch({ type: "set-frame-idx", frameIdx: maxProgress })
          return 0
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, play.frames.length, dispatch, speed])

  // Frame shown on the board: while playing, follow the playhead.
  const viewFrameIdx = playing ? Math.min(Math.floor(progress), play.frames.length - 2) : frameIdx
  const viewFrame = play.frames[viewFrameIdx]
  const viewNext = play.frames[viewFrameIdx + 1]
  const transitionT = playing ? progress - viewFrameIdx : 0

  const positions = useMemo(
    () => positionsAt(play, viewFrameIdx, transitionT),
    [play, viewFrameIdx, transitionT],
  )

  // ── Coordinate mapping ────────────────────────────────────────────────────
  const toCourtPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * COURT_WIDTH_M,
        y: ((clientY - rect.top) / rect.height) * courtLength(play.courtType),
      }
    },
    [play.courtType, svgRef],
  )

  // ── Pointer interactions ──────────────────────────────────────────────────
  const capturePointer = useCallback(
    (pointerId: number) => {
      try {
        svgRef.current?.setPointerCapture(pointerId)
      } catch {
        // An already-released pointer id must not abort the gesture.
      }
    },
    [svgRef],
  )

  const onElementPointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    el: PlayElement,
  ) => {
    if (playing) return
    e.stopPropagation()
    capturePointer(e.pointerId)
    const p = toCourtPoint(e.clientX, e.clientY)

    if (tool === "erase") {
      dispatch({ type: "remove-element", elementId: el.id })
      return
    }
    if (LINE_TOOLS.has(tool)) {
      const from = frame.positions[el.id] ?? p
      dragRef.current = { mode: "line", elementId: el.id, from }
      setPreview({ from, to: p })
      return
    }
    // select / move
    dispatch({ type: "select-element", elementId: el.id })
    dispatch({ type: "begin-gesture" })
    dragRef.current = { mode: "element", elementId: el.id }
  }

  const onViaPointerDown = (
    e: ReactPointerEvent<SVGCircleElement>,
    action: PlayAction,
    from: Point,
    to: Point,
  ) => {
    if (playing) return
    e.stopPropagation()
    capturePointer(e.pointerId)
    dispatch({ type: "select-action", actionId: action.id })
    dispatch({ type: "begin-gesture" })
    dragRef.current = { mode: "via", actionId: action.id, from, to }
  }

  const onBoardPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (playing) return
    const p = toCourtPoint(e.clientX, e.clientY)
    if (ADD_TOOLS.has(tool)) {
      dispatch({ type: "add-element", kind: tool as ElementKind, at: p })
      setTool("select")
      return
    }
    dispatch({ type: "select-element", elementId: null })
    dispatch({ type: "select-action", actionId: null })
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const p = toCourtPoint(e.clientX, e.clientY)
    if (drag.mode === "element") {
      dispatch({ type: "move-live", elementId: drag.elementId, point: p })
    } else if (drag.mode === "line") {
      setPreview({ from: drag.from, to: p })
    } else {
      dispatch({
        type: "via-live",
        actionId: drag.actionId,
        via: ctrlFromHandle(drag.from, drag.to, p),
      })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    setPreview(null)
    if (!drag || drag.mode !== "line") return
    const p = toCourtPoint(e.clientX, e.clientY)
    if (distance(drag.from, p) < 0.4) return

    const actionType = tool as ActionType
    if (actionType === "pass" || actionType === "handoff") {
      const target = elementAt(play, frame, p, drag.elementId)
      if (!target) return
      dispatch({
        type: "add-movement",
        elementId: drag.elementId,
        actionType,
        to: p,
        targetElementId: target.id,
      })
    } else {
      dispatch({
        type: "add-movement",
        elementId: drag.elementId,
        actionType,
        to: p,
      })
    }
  }

  // ── Roster drag & drop (players dropped from the roster panel) ───────────
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(PLAYER_DRAG_MIME)
    if (!raw) return
    e.preventDefault()
    let player: LinkedPlayer
    try {
      player = JSON.parse(raw) as LinkedPlayer
    } catch {
      return
    }
    const p = toCourtPoint(e.clientX, e.clientY)
    // Dropping on top of an existing attacker re-labels that token.
    const near = play.elements
      .filter((el) => el.kind === "attacker")
      .map((el) => ({ el, pos: frame.positions[el.id] }))
      .filter((x): x is { el: PlayElement; pos: Point } => !!x.pos)
      .map((x) => ({ ...x, d: distance(x.pos, p) }))
      .sort((a, b) => a.d - b.d)[0]
    if (near && near.d <= 1.4) {
      dispatch({ type: "assign-player", elementId: near.el.id, player })
    } else {
      dispatch({ type: "add-element", kind: "attacker", at: p, player })
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? "redo" : "undo" })
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault()
        dispatch({ type: "redo" })
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          dispatch({ type: "remove-element", elementId: selectedElementId })
        } else if (selectedActionId) {
          dispatch({ type: "remove-action", actionId: selectedActionId })
        }
      } else if (e.key === " ") {
        e.preventDefault()
        if (playing) stopPlayback(progress)
        else startPlayback()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    dispatch,
    playing,
    progress,
    selectedActionId,
    selectedElementId,
    startPlayback,
    stopPlayback,
  ])

  const L = courtLength(play.courtType)
  const holder = ballHolderId(play, viewFrame)

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        tool={tool}
        setTool={setTool}
        state={state}
        dispatch={dispatch}
        playing={playing}
      />

      <div
        className="relative overflow-hidden rounded-2xl border border-hairline shadow-[var(--shadow-court)]"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(PLAYER_DRAG_MIME)) e.preventDefault()
        }}
        onDrop={onDrop}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${COURT_WIDTH_M * SCALE} ${L * SCALE}`}
          className={cn(
            "block w-full touch-none select-none",
            tool === "select" && !playing && "cursor-default",
            (ADD_TOOLS.has(tool) || LINE_TOOLS.has(tool)) && !playing && "cursor-crosshair",
            tool === "erase" && !playing && "cursor-not-allowed",
          )}
          onPointerDown={onBoardPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null
            setPreview(null)
          }}
        >
          <g transform={`scale(${SCALE})`}>
            <PlaybookCourt courtType={play.courtType} />

            {/* Action lines of the frame on screen */}
            <g opacity={playing ? Math.max(0, 1 - transitionT * 1.6) : 1}>
              {viewFrame.actions.map((a) => (
                <ActionLine
                  key={a.id}
                  play={play}
                  frame={viewFrame}
                  next={viewNext}
                  action={a}
                  selected={a.id === selectedActionId && !playing}
                  editable={!playing}
                  onSelect={() => dispatch({ type: "select-action", actionId: a.id })}
                  onViaPointerDown={onViaPointerDown}
                />
              ))}
            </g>

            {/* Preview while drawing a line */}
            {preview ? (
              <path
                d={pathD(preview.from, preview.to, null)}
                stroke={BOARD.selected}
                strokeWidth={0.09}
                strokeDasharray={tool === "pass" || tool === "handoff" ? "0.28 0.2" : undefined}
                fill="none"
                opacity={0.85}
              />
            ) : null}

            {/* Elements */}
            {play.elements.map((el) => {
              const pos = positions[el.id]
              if (!pos) return null
              return (
                <Token
                  key={el.id}
                  element={el}
                  pos={pos}
                  selected={el.id === selectedElementId && !playing}
                  hasBall={el.id === holder}
                  onPointerDown={(e) => onElementPointerDown(e, el)}
                />
              )
            })}
          </g>
        </svg>

        {/* Frame note overlay */}
        {viewFrame.note ? (
          <div className="pointer-events-none absolute bottom-2 left-2 max-w-[70%] rounded-lg bg-white/85 px-2.5 py-1 font-mono text-[10px] leading-snug text-[#4c463d] shadow-sm backdrop-blur">
            {viewFrameIdx + 1}. {viewFrame.note}
          </div>
        ) : null}
      </div>

      <Timeline
        state={state}
        dispatch={dispatch}
        playing={playing}
        speed={speed}
        setSpeed={setSpeed}
        onPlay={startPlayback}
        onStop={() => stopPlayback(progress)}
        progress={progress}
      />

      {/* Frame note editor */}
      <input
        type="text"
        value={frame.note ?? ""}
        onChange={(e) => dispatch({ type: "set-frame-note", note: e.target.value })}
        placeholder={t("playbook.editor.notePlaceholder", { n: frameIdx + 1 })}
        maxLength={200}
        className="gh-input w-full text-sm"
        disabled={playing}
      />
    </div>
  )
}

// ── Interpolation ────────────────────────────────────────────────────────────

function positionsAt(
  play: Play,
  frameIdx: number,
  t: number,
): Record<string, Point> {
  const cur = play.frames[frameIdx]
  const next = play.frames[frameIdx + 1]
  if (!next || t <= 0) return cur.positions
  const eased = easeInOut(Math.min(1, t))
  const out: Record<string, Point> = {}
  const holder = ballHolderId(play, cur)
  const pass = cur.actions.find((a) => a.type === "pass" || a.type === "handoff")

  for (const el of play.elements) {
    const from = cur.positions[el.id]
    if (!from) continue
    const to = next.positions[el.id] ?? from
    let via: Point | null = null
    let tt = eased

    if (el.kind === "ball") {
      if (pass) {
        // The ball leaves the passer's hands a beat in and travels fast.
        tt = easeInOut(Math.min(1, Math.max(0, (t - 0.2) / 0.5)))
      } else if (holder) {
        const holderAction = cur.actions.find(
          (a) => a.elementId === holder && a.type !== "pass" && a.type !== "handoff",
        )
        if (holderAction?.via) {
          via = { x: holderAction.via.x + 0.42, y: holderAction.via.y - 0.1 }
        }
      }
    } else {
      const action = cur.actions.find(
        (a) => a.elementId === el.id && a.type !== "pass" && a.type !== "handoff",
      )
      via = action?.via ?? null
    }
    out[el.id] = pathPoint(from, to, via, tt)
  }
  return out
}

function elementAt(
  play: Play,
  frame: PlayFrame,
  p: Point,
  excludeId: string,
): PlayElement | null {
  let best: { el: PlayElement; d: number } | null = null
  for (const el of play.elements) {
    if (el.id === excludeId || el.kind === "ball") continue
    const pos = frame.positions[el.id]
    if (!pos) continue
    const d = distance(pos, p)
    if (d <= 1 && (!best || d < best.d)) best = { el, d }
  }
  return best?.el ?? null
}

// ── Tokens ───────────────────────────────────────────────────────────────────

function Token({
  element,
  pos,
  selected,
  hasBall,
  onPointerDown,
}: {
  element: PlayElement
  pos: Point
  selected: boolean
  hasBall: boolean
  onPointerDown: (e: ReactPointerEvent<SVGGElement>) => void
}) {
  const color =
    element.kind === "attacker"
      ? BOARD.attacker
      : element.kind === "defender"
        ? BOARD.defender
        : element.kind === "cone"
          ? BOARD.cone
          : element.kind === "coach"
            ? BOARD.coach
            : BOARD.ball

  return (
    <g
      transform={`translate(${pos.x} ${pos.y})`}
      onPointerDown={onPointerDown}
      className="cursor-grab active:cursor-grabbing"
    >
      {/* generous invisible hit area */}
      <circle r={0.75} fill="transparent" stroke="none" />
      {selected ? (
        <circle
          r={TOKEN_R + 0.18}
          fill="none"
          stroke={BOARD.selected}
          strokeWidth={0.07}
          strokeDasharray="0.16 0.12"
        />
      ) : null}

      {element.kind === "attacker" ? (
        <>
          <circle r={TOKEN_R} fill={color} stroke="#fff" strokeWidth={0.06} />
          <text
            y={0.16}
            textAnchor="middle"
            fontSize={0.5}
            fontWeight={700}
            fill="#fff"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {element.label}
          </text>
          {hasBall ? (
            <circle cx={TOKEN_R * 0.95} cy={-TOKEN_R * 0.75} r={0.14} fill={BOARD.ball} stroke="#fff" strokeWidth={0.035} />
          ) : null}
          {element.player ? (
            <text
              y={TOKEN_R + 0.42}
              textAnchor="middle"
              fontSize={0.3}
              fontWeight={600}
              fill="#5a5243"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              {shortName(element.player.name)}
            </text>
          ) : null}
        </>
      ) : null}

      {element.kind === "defender" ? (
        <>
          <line x1={-TOKEN_R * 0.8} y1={-TOKEN_R * 0.8} x2={TOKEN_R * 0.8} y2={TOKEN_R * 0.8} stroke={color} strokeWidth={0.16} strokeLinecap="round" />
          <line x1={-TOKEN_R * 0.8} y1={TOKEN_R * 0.8} x2={TOKEN_R * 0.8} y2={-TOKEN_R * 0.8} stroke={color} strokeWidth={0.16} strokeLinecap="round" />
          <text
            x={TOKEN_R + 0.1}
            y={-TOKEN_R * 0.6}
            fontSize={0.34}
            fontWeight={700}
            fill={color}
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {element.label}
          </text>
        </>
      ) : null}

      {element.kind === "ball" ? (
        <>
          <circle r={0.26} fill={BOARD.ball} stroke="#9a5b00" strokeWidth={0.04} />
          <path
            d="M -0.26 0 A 0.32 0.32 0 0 1 0.26 0 M 0 -0.26 A 0.32 0.32 0 0 1 0 0.26"
            stroke="#9a5b00"
            strokeWidth={0.035}
            fill="none"
          />
        </>
      ) : null}

      {element.kind === "cone" ? (
        <path
          d={`M 0 ${-TOKEN_R * 0.7} L ${TOKEN_R * 0.6} ${TOKEN_R * 0.55} L ${-TOKEN_R * 0.6} ${TOKEN_R * 0.55} Z`}
          fill={color}
          stroke="#fff"
          strokeWidth={0.05}
        />
      ) : null}

      {element.kind === "coach" ? (
        <>
          <rect x={-0.38} y={-0.38} width={0.76} height={0.76} rx={0.14} fill={color} stroke="#fff" strokeWidth={0.05} />
          <text
            y={0.15}
            textAnchor="middle"
            fontSize={0.42}
            fontWeight={700}
            fill="#fff"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            C
          </text>
        </>
      ) : null}
    </g>
  )
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`.slice(0, 16)
}

// ── Action lines ─────────────────────────────────────────────────────────────

function ActionLine({
  play,
  frame,
  next,
  action,
  selected,
  editable,
  onSelect,
  onViaPointerDown,
}: {
  play: Play
  frame: PlayFrame
  next: PlayFrame | undefined
  action: PlayAction
  selected: boolean
  editable: boolean
  onSelect: () => void
  onViaPointerDown: (
    e: ReactPointerEvent<SVGCircleElement>,
    action: PlayAction,
    from: Point,
    to: Point,
  ) => void
}) {
  const isPass = action.type === "pass" || action.type === "handoff"
  const from = frame.positions[action.elementId]
  if (!from) return null

  let to: Point | undefined
  if (isPass && action.targetElementId) {
    to = next?.positions[action.targetElementId] ?? frame.positions[action.targetElementId]
  } else {
    to = next?.positions[action.elementId]
  }
  if (!to || distance(from, to) < 0.15) return null

  const via = action.via ?? null
  const color = selected ? BOARD.selected : BOARD.action
  const endAngle = pathAngle(from, to, via, 1)
  // Trim the line so it stops at the token edge, not its centre.
  const trimmedTo = pathPoint(from, to, via, Math.max(0, 1 - (TOKEN_R + 0.12) / Math.max(0.01, distance(from, to))))
  const d =
    action.type === "dribble"
      ? dribblePathD(from, trimmedTo, via)
      : pathD(from, trimmedTo, via)

  const handle = curveHandle(from, to, via)

  return (
    <g>
      {/* wide invisible stroke for easy selection */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={0.5}
        fill="none"
        onPointerDown={(e) => {
          if (!editable) return
          e.stopPropagation()
          onSelect()
        }}
        className={editable ? "cursor-pointer" : undefined}
      />
      <path
        d={d}
        stroke={color}
        strokeWidth={0.08}
        strokeDasharray={isPass ? "0.3 0.22" : undefined}
        fill="none"
        strokeLinecap="round"
        pointerEvents="none"
      />

      {action.type === "screen" ? (
        <ScreenCap at={trimmedTo} angle={endAngle} color={color} />
      ) : action.type === "handoff" ? (
        <HandoffCap at={trimmedTo} angle={endAngle} color={color} />
      ) : (
        <ArrowHead at={trimmedTo} angle={endAngle} color={color} />
      )}

      {selected && editable ? (
        <circle
          cx={handle.x}
          cy={handle.y}
          r={0.2}
          fill="#fff"
          stroke={BOARD.selected}
          strokeWidth={0.06}
          className="cursor-move"
          onPointerDown={(e) => onViaPointerDown(e, action, from, to!)}
        />
      ) : null}
    </g>
  )
}

function ArrowHead({ at, angle, color }: { at: Point; angle: number; color: string }) {
  const size = 0.32
  const a1 = angle + Math.PI - 0.5
  const a2 = angle + Math.PI + 0.5
  return (
    <path
      d={`M ${at.x} ${at.y} L ${at.x + Math.cos(a1) * size} ${at.y + Math.sin(a1) * size} M ${at.x} ${at.y} L ${at.x + Math.cos(a2) * size} ${at.y + Math.sin(a2) * size}`}
      stroke={color}
      strokeWidth={0.09}
      strokeLinecap="round"
      fill="none"
      pointerEvents="none"
    />
  )
}

/** Standard screen notation: a perpendicular bar at the end of the path. */
function ScreenCap({ at, angle, color }: { at: Point; angle: number; color: string }) {
  const half = 0.3
  const nx = Math.cos(angle + Math.PI / 2)
  const ny = Math.sin(angle + Math.PI / 2)
  return (
    <line
      x1={at.x - nx * half}
      y1={at.y - ny * half}
      x2={at.x + nx * half}
      y2={at.y + ny * half}
      stroke={color}
      strokeWidth={0.11}
      strokeLinecap="round"
      pointerEvents="none"
    />
  )
}

/** Handoff notation: two short bars crossing the path near its end. */
function HandoffCap({ at, angle, color }: { at: Point; angle: number; color: string }) {
  const nx = Math.cos(angle + Math.PI / 2)
  const ny = Math.sin(angle + Math.PI / 2)
  const bx = Math.cos(angle)
  const by = Math.sin(angle)
  const half = 0.22
  const bar = (offset: number) => {
    const cx = at.x - bx * offset
    const cy = at.y - by * offset
    return `M ${cx - nx * half} ${cy - ny * half} L ${cx + nx * half} ${cy + ny * half}`
  }
  return (
    <path
      d={`${bar(0.18)} ${bar(0.42)}`}
      stroke={color}
      strokeWidth={0.09}
      strokeLinecap="round"
      fill="none"
      pointerEvents="none"
    />
  )
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({
  tool,
  setTool,
  state,
  dispatch,
  playing,
}: {
  tool: Tool
  setTool: (t: Tool) => void
  state: EditorState
  dispatch: PlayDispatch
  playing: boolean
}) {
  const t = useT()
  const { play, past, future } = state
  const hasBall = play.elements.some((e) => e.kind === "ball")

  const tools: { id: Tool; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: "select", label: t("playbook.tools.select"), icon: <IconCursor /> },
    { id: "attacker", label: t("playbook.tools.attacker"), icon: <IconAttacker /> },
    { id: "defender", label: t("playbook.tools.defender"), icon: <IconDefender /> },
    { id: "ball", label: t("playbook.tools.ball"), icon: <IconBall />, disabled: hasBall },
    { id: "cone", label: t("playbook.tools.cone"), icon: <IconCone /> },
    { id: "coach", label: t("playbook.tools.coach"), icon: <IconCoach /> },
  ]
  const lines: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "cut", label: t("playbook.tools.cut"), icon: <IconCut /> },
    { id: "dribble", label: t("playbook.tools.dribble"), icon: <IconDribble /> },
    { id: "screen", label: t("playbook.tools.screen"), icon: <IconScreen /> },
    { id: "pass", label: t("playbook.tools.pass"), icon: <IconPass /> },
    { id: "handoff", label: t("playbook.tools.handoff"), icon: <IconHandoff /> },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-hairline bg-surface-1 p-1.5">
      <ToolGroup>
        {tools.map((x) => (
          <ToolButton
            key={x.id}
            active={tool === x.id}
            label={x.label}
            disabled={playing || x.disabled}
            onClick={() => setTool(x.id)}
          >
            {x.icon}
          </ToolButton>
        ))}
      </ToolGroup>
      <Divider />
      <ToolGroup>
        {lines.map((x) => (
          <ToolButton
            key={x.id}
            active={tool === x.id}
            label={x.label}
            disabled={playing}
            onClick={() => setTool(x.id)}
          >
            {x.icon}
          </ToolButton>
        ))}
        <ToolButton
          active={tool === "erase"}
          label={t("playbook.tools.erase")}
          disabled={playing}
          onClick={() => setTool("erase")}
        >
          <IconErase />
        </ToolButton>
      </ToolGroup>
      <Divider />
      <ToolGroup>
        <ToolButton
          label={t("playbook.tools.undo")}
          disabled={playing || past.length === 0}
          onClick={() => dispatch({ type: "undo" })}
        >
          <IconUndo />
        </ToolButton>
        <ToolButton
          label={t("playbook.tools.redo")}
          disabled={playing || future.length === 0}
          onClick={() => dispatch({ type: "redo" })}
        >
          <IconRedo />
        </ToolButton>
      </ToolGroup>
      <div className="ml-auto flex items-center gap-1 rounded-lg border border-hairline bg-surface-0 p-0.5">
        {(["half", "full"] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={playing}
            onClick={() => dispatch({ type: "set-court", courtType: c })}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition",
              play.courtType === c
                ? "bg-brand-600 text-[#fff]"
                : "text-ink-400 hover:text-ink-100",
            )}
          >
            {c === "half" ? t("playbook.editor.halfCourt") : t("playbook.editor.fullCourt")}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-hairline" aria-hidden />
}

function ToolButton({
  active,
  label,
  disabled,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200",
        active
          ? "bg-brand-600 text-[#fff]"
          : "text-ink-300 hover:bg-white/[0.06] hover:text-ink-50",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  )
}

// ── Timeline & playback ──────────────────────────────────────────────────────

function Timeline({
  state,
  dispatch,
  playing,
  speed,
  setSpeed,
  onPlay,
  onStop,
  progress,
}: {
  state: EditorState
  dispatch: PlayDispatch
  playing: boolean
  speed: number
  setSpeed: (s: number) => void
  onPlay: () => void
  onStop: () => void
  progress: number
}) {
  const t = useT()
  const { play, frameIdx } = state
  const activeIdx = playing ? Math.min(Math.floor(progress), play.frames.length - 1) : frameIdx

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-1 p-1.5">
      <button
        type="button"
        onClick={playing ? onStop : onPlay}
        disabled={play.frames.length < 2}
        aria-label={playing ? t("playbook.editor.pause") : t("playbook.editor.play")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[#fff] shadow-sm transition hover:bg-brand-500 disabled:opacity-40"
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>

      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        aria-label={t("playbook.editor.speed")}
        className="gh-input h-8 w-auto px-2 py-0 font-mono text-[11px]"
      >
        {[0.5, 0.75, 1, 1.5, 2].map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
        {play.frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => !playing && dispatch({ type: "set-frame-idx", frameIdx: i })}
            title={f.note || undefined}
            className={cn(
              "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-[11px] font-bold transition",
              i === activeIdx
                ? "bg-brand-600 text-[#fff]"
                : "border border-hairline bg-surface-0 text-ink-300 hover:text-ink-50",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5">
        <ToolButton
          label={t("playbook.editor.addFrame")}
          disabled={playing}
          onClick={() => dispatch({ type: "add-frame" })}
        >
          <IconPlus />
        </ToolButton>
        <ToolButton
          label={t("playbook.editor.removeFrame")}
          disabled={playing || play.frames.length <= 1}
          onClick={() => dispatch({ type: "remove-frame" })}
        >
          <IconTrash />
        </ToolButton>
      </div>
    </div>
  )
}

// ── Icons (16px stroke icons, consistent with the app's inline SVG style) ───

const I = {
  size: 16,
  props: {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  },
}

function IconCursor() {
  return (
    <svg {...I.props}>
      <path d="M4 3l7 18 2.5-7.5L21 11z" />
    </svg>
  )
}
function IconAttacker() {
  return (
    <svg {...I.props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v7" strokeWidth={2.4} />
    </svg>
  )
}
function IconDefender() {
  return (
    <svg {...I.props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
function IconBall() {
  return (
    <svg {...I.props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 8.5c4 2.5 11 2.5 15 0M4.5 15.5c4-2.5 11-2.5 15 0M12 4v16" strokeWidth={1.4} />
    </svg>
  )
}
function IconCone() {
  return (
    <svg {...I.props}>
      <path d="M12 4l6 15H6z" />
    </svg>
  )
}
function IconCoach() {
  return (
    <svg {...I.props}>
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M14.5 10a3 3 0 1 0 0 4" />
    </svg>
  )
}
function IconCut() {
  return (
    <svg {...I.props}>
      <path d="M4 18L17 7" />
      <path d="M13 6l5-1-1 5" />
    </svg>
  )
}
function IconDribble() {
  return (
    <svg {...I.props}>
      <path d="M3 17c2-3 4 3 6 0s4 3 6 0 3-3 4-4" />
      <path d="M16 8l4 4-4 1" />
    </svg>
  )
}
function IconScreen() {
  return (
    <svg {...I.props}>
      <path d="M6 18L15 9" />
      <path d="M13 5l6 6" />
    </svg>
  )
}
function IconPass() {
  return (
    <svg {...I.props}>
      <path d="M4 18L17 7" strokeDasharray="3 3" />
      <path d="M13 6l5-1-1 5" />
    </svg>
  )
}
function IconHandoff() {
  return (
    <svg {...I.props}>
      <path d="M4 18L16 8" strokeDasharray="3 3" />
      <path d="M14 4l4 4M12 8l4 4" />
    </svg>
  )
}
function IconErase() {
  return (
    <svg {...I.props}>
      <path d="M5 14l7-7 7 7-5 5H10z" />
      <path d="M8 21h11" />
    </svg>
  )
}
function IconUndo() {
  return (
    <svg {...I.props}>
      <path d="M4 10h10a5 5 0 0 1 0 10h-3" />
      <path d="M8 6l-4 4 4 4" />
    </svg>
  )
}
function IconRedo() {
  return (
    <svg {...I.props}>
      <path d="M20 10H10a5 5 0 0 0 0 10h3" />
      <path d="M16 6l4 4-4 4" />
    </svg>
  )
}
function IconPlay() {
  return (
    <svg {...I.props} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}
function IconPause() {
  return (
    <svg {...I.props} fill="currentColor" stroke="none">
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  )
}
function IconPlus() {
  return (
    <svg {...I.props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function IconTrash() {
  return (
    <svg {...I.props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
    </svg>
  )
}
