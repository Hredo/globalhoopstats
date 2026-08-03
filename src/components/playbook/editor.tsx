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
  type PlayDrawing,
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
  nearestRim,
  pathAngle,
  pathD,
  pathPoint,
} from "@/lib/playbook/geometry"
import { BOARD, PlaybookCourt } from "@/components/playbook/court"
import {
  ballHolderId,
  isBallAction,
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
  | "chair"
  | "text"
  | "cut"
  | "dribble"
  | "screen"
  | "pass"
  | "handoff"
  | "shot"
  | "pen"
  | "erase"

const LINE_TOOLS: ReadonlySet<Tool> = new Set([
  "cut",
  "dribble",
  "screen",
  "pass",
  "handoff",
  "shot",
])
const ADD_TOOLS: ReadonlySet<Tool> = new Set([
  "attacker",
  "defender",
  "ball",
  "cone",
  "coach",
  "chair",
  "text",
])

const TOKEN_R = 0.45
const DEFAULT_LEN = 2
export const PLAYER_DRAG_MIME = "application/x-ghs-player"

/** Freehand samples closer together than this (metres) are dropped. */
const PEN_MIN_STEP = 0.12

type DragState =
  | { mode: "element"; elementId: string }
  | { mode: "via"; actionId: string; from: Point; to: Point }
  | { mode: "endpoint"; elementId: string; actionId: string }
  | { mode: "pen" }

type Props = {
  state: EditorState
  dispatch: PlayDispatch
  svgRef: RefObject<SVGSVGElement | null>
  playing: boolean
  progress: number
  horizontal: boolean
  onToggleOrientation: () => void
  tool: Tool
  setTool: (t: Tool) => void
  /**
   * Render the built-in desktop tool rail. Coach mode places its own rail in
   * the margin beside the board, so it opts out rather than getting two.
   */
  showToolbar?: boolean
  /** Extra classes for the board's outer frame (mobile sizing). */
  className?: string
}

export function PlayEditor({
  state,
  dispatch,
  svgRef,
  playing,
  progress,
  horizontal,
  onToggleOrientation,
  tool,
  setTool,
  showToolbar = true,
  className,
}: Props) {
  const t = useT()
  const { play, frameIdx, selectedElementId, selectedActionId } = state
  const frame = play.frames[frameIdx]

  const dragRef = useRef<DragState | null>(null)
  const penRef = useRef<Point[]>([])
  const [penPreview, setPenPreview] = useState<Point[] | null>(null)

  /** Edits are only frozen while the play animates. */
  const locked = playing

  // Frame shown on the board: while playing, follow the playhead.
  const viewFrameIdx = playing ? Math.max(0, Math.min(Math.floor(progress), play.frames.length - 2)) : frameIdx
  const viewFrame = play.frames[viewFrameIdx]
  const viewNext = play.frames[viewFrameIdx + 1]
  const transitionT = playing ? progress - viewFrameIdx : 0

  const positions = useMemo(
    () => positionsAt(play, viewFrameIdx, transitionT),
    [play, viewFrameIdx, transitionT],
  )

  // ── Coordinate mapping ────────────────────────────────────────────────────
  // In horizontal mode the court is laid on its side (rotated -90°): the hoop
  // sits on the left, screen-x runs along the court length and screen-y runs
  // across the width (inverted).
  const toCourtPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      const rx = (clientX - rect.left) / rect.width
      const ry = (clientY - rect.top) / rect.height
      if (horizontal) {
        return {
          x: (1 - ry) * COURT_WIDTH_M,
          y: rx * courtLength(play.courtType),
        }
      }
      return {
        x: rx * COURT_WIDTH_M,
        y: ry * courtLength(play.courtType),
      }
    },
    [play.courtType, svgRef, horizontal],
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

  const commitLine = useCallback(
    (elementId: string, to: Point) => {
      const actionType = tool as ActionType
      if (actionType === "pass" || actionType === "handoff") {
        const target = elementAt(play, frame, to, elementId)
        if (!target) return
        dispatch({ type: "add-movement", elementId, actionType, to, targetElementId: target.id })
      } else if (actionType === "screen") {
        // Record who the screen is for: it is what makes the PDF and the AI
        // read "O5 screens for O1" instead of a nameless bar on the floor.
        const from = frame.positions[elementId]
        const user = from ? nearestElement(play, frame, from, elementId) : null
        dispatch({
          type: "add-movement",
          elementId,
          actionType,
          to,
          targetElementId: user?.id ?? null,
        })
      } else {
        dispatch({ type: "add-movement", elementId, actionType, to })
      }
      setTool("select")
    },
    [tool, play, frame, dispatch, setTool],
  )

  function defaultEndpoint(from: Point): Point {
    // Aim the default movement at the hoop (near baseline on half court,
    // far baseline on full court) so the arrow points somewhere sensible.
    const basketY = play.courtType === "half" ? 0 : 28
    const dx = 7.5 - from.x
    const dy = basketY - from.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const len = Math.min(DEFAULT_LEN, dist * 0.5)
    return {
      x: from.x + (dx / dist) * len,
      y: from.y + (dy / dist) * len,
    }
  }

  const onElementPointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    el: PlayElement,
  ) => {
    if (locked) return
    e.stopPropagation()
    capturePointer(e.pointerId)

    if (tool === "erase") {
      dispatch({ type: "remove-element", elementId: el.id })
      return
    }
    if (LINE_TOOLS.has(tool)) {
      const from = frame.positions[el.id]
      if (!from) return
      if (tool === "pass" || tool === "handoff") {
        // Default receiver: the closest teammate; the endpoint handle can
        // then be dragged to adjust where the catch happens.
        const target = nearestElement(play, frame, from, el.id)
        if (target) {
          const targetPos = frame.positions[target.id]
          if (targetPos) commitLine(el.id, targetPos)
        }
      } else if (tool === "shot") {
        commitLine(el.id, nearestRim(from, play.courtType))
      } else {
        commitLine(el.id, defaultEndpoint(from))
      }
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
    if (locked) return
    e.stopPropagation()
    capturePointer(e.pointerId)
    dispatch({ type: "select-action", actionId: action.id })
    dispatch({ type: "begin-gesture" })
    dragRef.current = { mode: "via", actionId: action.id, from, to }
  }

  const onEndPointerDown = (
    e: ReactPointerEvent<SVGCircleElement>,
    elementId: string,
    actionId: string,
  ) => {
    if (locked) return
    e.stopPropagation()
    capturePointer(e.pointerId)
    dispatch({ type: "select-action", actionId })
    dispatch({ type: "begin-gesture" })
    dragRef.current = { mode: "endpoint", elementId, actionId }
  }

  const onBoardPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (locked) return
    const p = toCourtPoint(e.clientX, e.clientY)
    if (tool === "pen") {
      capturePointer(e.pointerId)
      penRef.current = [p]
      setPenPreview([p])
      dragRef.current = { mode: "pen" }
      return
    }
    if (tool === "text") {
      const label = window.prompt(t("playbook.tools.textPrompt"))?.trim()
      if (label) dispatch({ type: "add-element", kind: "text", at: p, label })
      setTool("select")
      return
    }
    if (ADD_TOOLS.has(tool)) {
      dispatch({ type: "add-element", kind: tool as ElementKind, at: p })
      return
    }
    dispatch({ type: "select-element", elementId: null })
    dispatch({ type: "select-action", actionId: null })
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const p = toCourtPoint(e.clientX, e.clientY)
    if (drag.mode === "pen") {
      const last = penRef.current[penRef.current.length - 1]
      // Thin the samples: a 60 Hz drag across the board is thousands of points
      // and every one of them would be persisted and re-parsed on load.
      if (last && distance(last, p) < PEN_MIN_STEP) return
      penRef.current.push(p)
      setPenPreview([...penRef.current])
      return
    }
    if (drag.mode === "element") {
      dispatch({ type: "move-live", elementId: drag.elementId, point: p })
    } else if (drag.mode === "via") {
      dispatch({
        type: "via-live",
        actionId: drag.actionId,
        via: ctrlFromHandle(drag.from, drag.to, p),
      })
    } else if (drag.mode === "endpoint") {
      dispatch({ type: "move-next-live", elementId: drag.elementId, point: p })
    }
  }

  const onPointerUp = () => {
    if (dragRef.current?.mode === "pen") {
      const points = penRef.current
      if (points.length >= 2) dispatch({ type: "add-drawing", points })
      penRef.current = []
      setPenPreview(null)
    }
    dragRef.current = null
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
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (playing) return
        e.preventDefault()
        dispatch({
          type: "set-frame-idx",
          frameIdx: frameIdx + (e.key === "ArrowRight" ? 1 : -1),
        })
      } else if (e.key === "Escape") {
        setTool("select")
        dispatch({ type: "select-element", elementId: null })
        dispatch({ type: "select-action", actionId: null })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    dispatch,
    selectedActionId,
    selectedElementId,
    frameIdx,
    playing,
    setTool,
  ])

  const L = courtLength(play.courtType)
  const holder = ballHolderId(play, viewFrame)

  // Horizontal = court laid on its side: rotate the whole board -90° so the
  // hoop sits on the left. Tokens counter-rotate to keep their labels upright.
  const vbW = horizontal ? L : COURT_WIDTH_M
  const vbH = horizontal ? COURT_WIDTH_M : L
  const boardTransform = horizontal
    ? `scale(${SCALE}) translate(0 ${COURT_WIDTH_M}) rotate(-90)`
    : `scale(${SCALE})`

  return (
    <div className="flex flex-1 items-start gap-3">
      {/* Desktop rail: the phone/tablet toolbar lives in the thumb zone at the
          bottom of the shell instead (see PlaybookApp). */}
      {showToolbar ? (
        <div className="hidden lg:block">
          <Toolbar
            tool={tool}
            setTool={setTool}
            state={state}
            dispatch={dispatch}
            playing={playing}
            horizontal={horizontal}
            onToggleOrientation={onToggleOrientation}
          />
        </div>
      ) : null}

      {/* Canvas container — premium single-surface */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl border border-hairline bg-surface-1/95 p-1 shadow-md sm:p-1.5",
          className,
        )}
      >
        <div
          className="relative mx-auto w-full overflow-hidden rounded-lg bg-white/[0.01] transition-[max-width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            // The board is the point of the screen: let it take every pixel the
            // surrounding chrome does not need. --board-vh is set per layout.
            maxWidth: `min(100%, calc(var(--board-vh, 76vh) * ${(vbW / vbH).toFixed(4)}))`,
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(PLAYER_DRAG_MIME)) e.preventDefault()
          }}
          onDrop={onDrop}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${vbW * SCALE} ${vbH * SCALE}`}
            className={cn(
              "block w-full touch-none select-none",
              tool === "select" && !playing && "cursor-default",
              (ADD_TOOLS.has(tool) || LINE_TOOLS.has(tool)) && !playing && "cursor-crosshair",
              tool === "pen" && !playing && "cursor-crosshair",
              tool === "erase" && !playing && "cursor-not-allowed",
            )}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              penRef.current = []
              setPenPreview(null)
              dragRef.current = null
            }}
          >
            <g transform={boardTransform} style={{ transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1)" }}>
              <PlaybookCourt courtType={play.courtType} />

              {/* Freehand marker strokes sit under the notation */}
              <g opacity={playing ? Math.max(0, 1 - transitionT * 1.6) : 1}>
                {(viewFrame.drawings ?? []).map((d) => (
                  <PenStroke
                    key={d.id}
                    drawing={d}
                    erasable={!playing && tool === "erase"}
                    onErase={() => dispatch({ type: "remove-drawing", drawingId: d.id })}
                  />
                ))}
                {penPreview && penPreview.length > 1 ? (
                  <PenStroke drawing={{ id: "preview", points: penPreview }} />
                ) : null}
              </g>

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
                    onEndPointerDown={onEndPointerDown}
                  />
                ))}
              </g>

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
                    rotated={horizontal}
                    onPointerDown={(e) => onElementPointerDown(e, el)}
                  />
                )
              })}
            </g>
          </svg>

          {/* Nothing that can be tapped goes over the court: the half/full
              switch lives in the tool rail and the note under the board. The
              only thing left on top is this counter, which is inert. */}
          <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-gray-900/90 px-2 py-0.5 font-mono text-[10px] text-gray-200 shadow-md ring-1 ring-white/15">
            {viewFrameIdx + 1} / {play.frames.length}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Non-interactive snapshot of one frame — used by the PDF export. */
export function StaticFrame({ play, frameIdx }: { play: Play; frameIdx: number }) {
  const frame = play.frames[frameIdx]
  const next = play.frames[frameIdx + 1]
  const L = courtLength(play.courtType)
  const holder = ballHolderId(play, frame)
  const noop = () => {}
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${COURT_WIDTH_M * SCALE} ${L * SCALE}`}
      width={COURT_WIDTH_M * SCALE}
      height={L * SCALE}
    >
      <g transform={`scale(${SCALE})`}>
        <PlaybookCourt courtType={play.courtType} />
        {(frame.drawings ?? []).map((d) => (
          <PenStroke key={d.id} drawing={d} />
        ))}
        {frame.actions.map((a) => (
          <ActionLine
            key={a.id}
            play={play}
            frame={frame}
            next={next}
            action={a}
            selected={false}
            editable={false}
            onSelect={noop}
            onViaPointerDown={noop}
            onEndPointerDown={noop}
          />
        ))}
        {play.elements.map((el) => {
          const pos = frame.positions[el.id]
          if (!pos) return null
          return (
            <Token
              key={el.id}
              element={el}
              pos={pos}
              selected={false}
              hasBall={el.id === holder}
              onPointerDown={noop}
            />
          )
        })}
      </g>
    </svg>
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
  const pass = cur.actions.find((a) => isBallAction(a.type))

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
          (a) => a.elementId === holder && !isBallAction(a.type),
        )
        if (holderAction?.via) {
          via = { x: holderAction.via.x + 0.42, y: holderAction.via.y - 0.1 }
        }
      }
    } else {
      const action = cur.actions.find(
        (a) => a.elementId === el.id && !isBallAction(a.type),
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

/** Closest player token to a point, with no radius cap (pass receivers). */
function nearestElement(
  play: Play,
  frame: PlayFrame,
  p: Point,
  excludeId: string,
): PlayElement | null {
  let best: { el: PlayElement; d: number } | null = null
  for (const el of play.elements) {
    if (el.id === excludeId) continue
    if (el.kind !== "attacker" && el.kind !== "defender") continue
    const pos = frame.positions[el.id]
    if (!pos) continue
    const d = distance(pos, p)
    if (!best || d < best.d) best = { el, d }
  }
  return best?.el ?? null
}

// ── Tokens ───────────────────────────────────────────────────────────────────

function Token({
  element,
  pos,
  selected,
  hasBall,
  rotated,
  onPointerDown,
}: {
  element: PlayElement
  pos: Point
  selected: boolean
  hasBall: boolean
  /** Counter-rotate the token so labels stay upright on a rotated board. */
  rotated?: boolean
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
            : element.kind === "chair"
              ? BOARD.chair
              : element.kind === "text"
                ? BOARD.text
                : BOARD.ball

  return (
    <g
      transform={`translate(${pos.x} ${pos.y})${rotated ? " rotate(90)" : ""}`}
      onPointerDown={onPointerDown}
      className="cursor-grab active:cursor-grabbing"
    >
      {/* generous invisible hit area */}
      <circle r={0.75} fill="transparent" stroke="none" />
      {selected ? (
        <circle
          r={TOKEN_R + 0.2}
          fill="none"
          stroke={BOARD.selected}
          strokeWidth={0.1}
          strokeDasharray="0.18 0.13"
        />
      ) : null}
      {element.kind === "attacker" ? (
        <>
          {/* soft contact shadow lifts the token off the floor */}
          <ellipse cx={0.04} cy={TOKEN_R * 0.35} rx={TOKEN_R * 1.05} ry={TOKEN_R * 0.9} fill="#000" opacity={0.12} />
          <circle r={TOKEN_R} fill={color} stroke="#fff" strokeWidth={0.09} />
          <text
            y={0.17}
            textAnchor="middle"
            fontSize={0.52}
            fontWeight={700}
            fill="#fff"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {element.label}
          </text>
          {hasBall ? (
            <circle cx={TOKEN_R * 0.95} cy={-TOKEN_R * 0.75} r={0.17} fill={BOARD.ball} stroke="#fff" strokeWidth={0.05} />
          ) : null}
          {element.player ? (
            <text
              y={TOKEN_R + 0.44}
              textAnchor="middle"
              fontSize={0.32}
              fontWeight={600}
              fill="#453d31"
              stroke="#f2ede2"
              strokeWidth={0.06}
              paintOrder="stroke"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              {shortName(element.player.name)}
            </text>
          ) : null}
        </>
      ) : null}

      {element.kind === "defender" ? (
        <>
          <line x1={-TOKEN_R * 0.8} y1={-TOKEN_R * 0.8} x2={TOKEN_R * 0.8} y2={TOKEN_R * 0.8} stroke={color} strokeWidth={0.2} strokeLinecap="round" />
          <line x1={-TOKEN_R * 0.8} y1={TOKEN_R * 0.8} x2={TOKEN_R * 0.8} y2={-TOKEN_R * 0.8} stroke={color} strokeWidth={0.2} strokeLinecap="round" />
          <text
            x={TOKEN_R + 0.12}
            y={-TOKEN_R * 0.55}
            fontSize={0.4}
            fontWeight={700}
            fill={color}
            stroke="#f2ede2"
            strokeWidth={0.05}
            paintOrder="stroke"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {element.label}
          </text>
        </>
      ) : null}

      {element.kind === "ball" ? (
        <>
          <circle r={0.3} fill={BOARD.ball} stroke="#8a5200" strokeWidth={0.05} />
          <path
            d="M -0.3 0 A 0.37 0.37 0 0 1 0.3 0 M 0 -0.3 A 0.37 0.37 0 0 1 0 0.3"
            stroke="#8a5200"
            strokeWidth={0.04}
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

      {/* Chair / dummy: the drill prop coaches stand in for a passive defender */}
      {element.kind === "chair" ? (
        <>
          <path
            d={`M ${-TOKEN_R * 0.6} ${TOKEN_R * 0.6} L ${-TOKEN_R * 0.6} ${-TOKEN_R * 0.7} L ${TOKEN_R * 0.6} ${-TOKEN_R * 0.7}`}
            fill="none"
            stroke={color}
            strokeWidth={0.16}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={-TOKEN_R * 0.6}
            y1={TOKEN_R * 0.1}
            x2={TOKEN_R * 0.6}
            y2={TOKEN_R * 0.1}
            stroke={color}
            strokeWidth={0.16}
            strokeLinecap="round"
          />
        </>
      ) : null}

      {/* Free-text annotation — a coaching point pinned to a spot on the floor */}
      {element.kind === "text" ? (
        <text
          y={0.13}
          textAnchor="middle"
          fontSize={0.44}
          fontWeight={700}
          fill={color}
          stroke={BOARD.floor}
          strokeWidth={0.14}
          paintOrder="stroke"
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {element.label}
        </text>
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
  onEndPointerDown,
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
  onEndPointerDown: (
    e: ReactPointerEvent<SVGCircleElement>,
    elementId: string,
    actionId: string,
  ) => void
}) {
  const isShot = action.type === "shot"
  const isPass = action.type === "pass" || action.type === "handoff"
  const from = frame.positions[action.elementId]
  if (!from) return null

  let to: Point | undefined
  const endElementId =
    isPass && action.targetElementId ? action.targetElementId : action.elementId
  if (isShot) {
    // A shot always ends at the rim, whatever the shooter does next.
    to = nearestRim(from, play.courtType)
  } else if (isPass && action.targetElementId) {
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
        strokeWidth={0.11}
        strokeDasharray={isPass ? "0.32 0.22" : undefined}
        fill="none"
        strokeLinecap="round"
        pointerEvents="none"
      />

      {action.type === "screen" ? (
        <ScreenCap at={trimmedTo} angle={endAngle} color={color} />
      ) : action.type === "handoff" ? (
        <HandoffCap at={trimmedTo} angle={endAngle} color={color} />
      ) : action.type === "shot" ? (
        <ShotCap at={trimmedTo} color={color} />
      ) : (
        <ArrowHead at={trimmedTo} angle={endAngle} color={color} />
      )}

      {/* A shot has no draggable endpoint — the rim is not negotiable. */}
      {selected && editable && isShot ? (
        <circle
          cx={handle.x}
          cy={handle.y}
          r={0.24}
          fill="#fff"
          stroke={BOARD.selected}
          strokeWidth={0.09}
          className="cursor-move"
          onPointerDown={(e) => onViaPointerDown(e, action, from, to)}
        />
      ) : null}

      {selected && editable && !isShot ? (
        <>
          <circle
            cx={handle.x}
            cy={handle.y}
            r={0.24}
            fill="#fff"
            stroke={BOARD.selected}
            strokeWidth={0.09}
            className="cursor-move"
            onPointerDown={(e) => onViaPointerDown(e, action, from, to)}
          />
          <circle
            cx={trimmedTo.x}
            cy={trimmedTo.y}
            r={0.26}
            fill="#fff"
            stroke={BOARD.selected}
            strokeWidth={0.11}
            className="cursor-move"
            onPointerDown={(e) => onEndPointerDown(e, endElementId, action.id)}
          />
        </>
      ) : null}
    </g>
  )
}

function ArrowHead({ at, angle, color }: { at: Point; angle: number; color: string }) {
  const size = 0.36
  const a1 = angle + Math.PI - 0.5
  const a2 = angle + Math.PI + 0.5
  return (
    <path
      d={`M ${at.x} ${at.y} L ${at.x + Math.cos(a1) * size} ${at.y + Math.sin(a1) * size} M ${at.x} ${at.y} L ${at.x + Math.cos(a2) * size} ${at.y + Math.sin(a2) * size}`}
      stroke={color}
      strokeWidth={0.12}
      strokeLinecap="round"
      fill="none"
      pointerEvents="none"
    />
  )
}

/** Standard screen notation: a perpendicular bar at the end of the path. */
function ScreenCap({ at, angle, color }: { at: Point; angle: number; color: string }) {
  const half = 0.34
  const nx = Math.cos(angle + Math.PI / 2)
  const ny = Math.sin(angle + Math.PI / 2)
  return (
    <line
      x1={at.x - nx * half}
      y1={at.y - ny * half}
      x2={at.x + nx * half}
      y2={at.y + ny * half}
      stroke={color}
      strokeWidth={0.14}
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
      strokeWidth={0.12}
      strokeLinecap="round"
      fill="none"
      pointerEvents="none"
    />
  )
}

/** Shot notation: the line ends in a target ring over the rim. */
function ShotCap({ at, color }: { at: Point; color: string }) {
  return (
    <g pointerEvents="none">
      <circle cx={at.x} cy={at.y} r={0.3} fill="none" stroke={color} strokeWidth={0.11} />
      <circle cx={at.x} cy={at.y} r={0.1} fill={color} />
    </g>
  )
}

/** Freehand marker stroke. Tapping it with the eraser removes it. */
function PenStroke({
  drawing,
  erasable,
  onErase,
}: {
  drawing: PlayDrawing
  erasable?: boolean
  onErase?: () => void
}) {
  const d = drawing.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")
  return (
    <g>
      {erasable ? (
        <path
          d={d}
          stroke="transparent"
          strokeWidth={0.6}
          fill="none"
          className="cursor-pointer"
          onPointerDown={(e) => {
            e.stopPropagation()
            onErase?.()
          }}
        />
      ) : null}
      <path
        d={d}
        stroke={BOARD.pen}
        strokeWidth={0.13}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.85}
        pointerEvents="none"
      />
    </g>
  )
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

type ToolEntry = {
  id: Tool
  label: string
  /** Two or three characters shown under the icon on touch layouts. */
  short: string
  icon: React.ReactNode
  disabled?: boolean
}

type ToolSection = { key: string; title: string; items: ToolEntry[] }

/**
 * The palette, grouped the way a coach thinks about a board: who is on the
 * floor, what they do, and free marker on top. Both layouts render the same
 * sections — only the axis and the labelling change.
 */
function useToolSections(play: Play): ToolSection[] {
  const t = useT()
  const hasBall = play.elements.some((e) => e.kind === "ball")
  return [
    {
      key: "pieces",
      title: t("playbook.toolGroups.pieces"),
      items: [
        { id: "select", label: t("playbook.tools.select"), short: t("playbook.toolsShort.select"), icon: <IconCursor /> },
        { id: "attacker", label: t("playbook.tools.attacker"), short: t("playbook.toolsShort.attacker"), icon: <IconAttacker /> },
        { id: "defender", label: t("playbook.tools.defender"), short: t("playbook.toolsShort.defender"), icon: <IconDefender /> },
        { id: "ball", label: t("playbook.tools.ball"), short: t("playbook.toolsShort.ball"), icon: <IconBall />, disabled: hasBall },
        { id: "cone", label: t("playbook.tools.cone"), short: t("playbook.toolsShort.cone"), icon: <IconCone /> },
        { id: "chair", label: t("playbook.tools.chair"), short: t("playbook.toolsShort.chair"), icon: <IconChair /> },
        { id: "coach", label: t("playbook.tools.coach"), short: t("playbook.toolsShort.coach"), icon: <IconCoach /> },
      ],
    },
    {
      key: "actions",
      title: t("playbook.toolGroups.actions"),
      items: [
        { id: "cut", label: t("playbook.tools.cut"), short: t("playbook.toolsShort.cut"), icon: <IconCut /> },
        { id: "dribble", label: t("playbook.tools.dribble"), short: t("playbook.toolsShort.dribble"), icon: <IconDribble /> },
        { id: "screen", label: t("playbook.tools.screen"), short: t("playbook.toolsShort.screen"), icon: <IconScreen /> },
        { id: "pass", label: t("playbook.tools.pass"), short: t("playbook.toolsShort.pass"), icon: <IconPass /> },
        { id: "handoff", label: t("playbook.tools.handoff"), short: t("playbook.toolsShort.handoff"), icon: <IconHandoff /> },
        { id: "shot", label: t("playbook.tools.shot"), short: t("playbook.toolsShort.shot"), icon: <IconShot /> },
      ],
    },
    {
      key: "marker",
      title: t("playbook.toolGroups.marker"),
      items: [
        { id: "pen", label: t("playbook.tools.pen"), short: t("playbook.toolsShort.pen"), icon: <IconPen /> },
        { id: "text", label: t("playbook.tools.text"), short: t("playbook.toolsShort.text"), icon: <IconText /> },
        { id: "erase", label: t("playbook.tools.erase"), short: t("playbook.toolsShort.erase"), icon: <IconErase /> },
      ],
    },
  ]
}

type UtilityAction = {
  key: string
  label: string
  short: string
  icon: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

/**
 * Board-level actions that are not drawing tools. Shared so the vertical rail
 * and the touch rail can never drift apart — and so the half/full switch has a
 * home that isn't floating on top of the court blocking the tokens under it.
 */
function useUtilityActions({
  state, dispatch, playing, horizontal, onToggleOrientation,
}: {
  state: EditorState
  dispatch: PlayDispatch
  playing: boolean
  horizontal: boolean
  onToggleOrientation: () => void
}): UtilityAction[] {
  const t = useT()
  const { play, past, future } = state
  const isFull = play.courtType === "full"

  return [
    {
      key: "undo",
      label: t("playbook.tools.undo"),
      short: t("playbook.toolsShort.undo"),
      icon: <IconUndo />,
      disabled: playing || past.length === 0,
      onClick: () => dispatch({ type: "undo" }),
    },
    {
      key: "redo",
      label: t("playbook.tools.redo"),
      short: t("playbook.toolsShort.redo"),
      icon: <IconRedo />,
      disabled: playing || future.length === 0,
      onClick: () => dispatch({ type: "redo" }),
    },
    {
      key: "court",
      label: isFull ? t("playbook.editor.switchToHalf") : t("playbook.editor.switchToFull"),
      // The caption names the court you are on, so it reads as a state.
      short: isFull ? t("playbook.editor.fullCourt") : t("playbook.editor.halfCourt"),
      icon: <IconCourt full={isFull} />,
      active: isFull,
      disabled: playing,
      onClick: () => dispatch({ type: "set-court", courtType: isFull ? "half" : "full" }),
    },
    {
      key: "orientation",
      label: horizontal ? t("playbook.editor.vertical") : t("playbook.editor.horizontal"),
      short: t("playbook.toolsShort.rotate"),
      icon: <IconOrientation horizontal={horizontal} />,
      active: horizontal,
      onClick: onToggleOrientation,
    },
    {
      key: "flip",
      label: t("playbook.tools.flip"),
      short: t("playbook.toolsShort.flip"),
      icon: <IconFlip />,
      disabled: playing,
      onClick: () => dispatch({ type: "flip-horizontal" }),
    },
  ]
}

export function Toolbar({
  tool,
  setTool,
  state,
  dispatch,
  playing,
  horizontal,
  onToggleOrientation,
}: {
  tool: Tool
  setTool: (t: Tool) => void
  state: EditorState
  dispatch: PlayDispatch
  playing: boolean
  horizontal: boolean
  onToggleOrientation: () => void
}) {
  const sections = useToolSections(state.play)
  const utilities = useUtilityActions({ state, dispatch, playing, horizontal, onToggleOrientation })

  return (
    <div className="flex w-[76px] shrink-0 flex-col gap-2 self-start rounded-xl border border-hairline bg-surface-1/95 p-2 shadow-md">
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-1">
          <p className="px-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-500">
            {section.title}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {section.items.map((x) => (
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
          </div>
        </div>
      ))}

      <span className="h-px w-full bg-hairline/70" aria-hidden />

      <div className="grid grid-cols-2 gap-1">
        {utilities.map((u) => (
          <ToolButton
            key={u.key}
            active={u.active}
            label={u.label}
            disabled={u.disabled}
            onClick={u.onClick}
          >
            {u.icon}
          </ToolButton>
        ))}
      </div>
    </div>
  )
}

/**
 * Touch layout: one horizontal rail parked in the thumb zone. Each tool keeps
 * its name so nobody has to decode a 14px glyph mid-timeout, and the whole rail
 * scrolls sideways instead of stealing width from the board.
 */
export function ToolRail({
  tool,
  setTool,
  state,
  dispatch,
  playing,
  horizontal,
  onToggleOrientation,
}: {
  tool: Tool
  setTool: (t: Tool) => void
  state: EditorState
  dispatch: PlayDispatch
  playing: boolean
  horizontal: boolean
  onToggleOrientation: () => void
}) {
  const sections = useToolSections(state.play)
  const utilities = useUtilityActions({ state, dispatch, playing, horizontal, onToggleOrientation })

  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto rounded-xl border border-hairline bg-surface-1/95 p-1.5 shadow-md scrollbar-thin">
      {sections.map((section, i) => (
        <div key={section.key} className="flex shrink-0 items-stretch gap-1.5">
          {i > 0 ? <span className="my-1 w-px shrink-0 bg-hairline/70" aria-hidden /> : null}
          {section.items.map((x) => (
            <RailButton
              key={x.id}
              active={tool === x.id}
              label={x.label}
              short={x.short}
              disabled={playing || x.disabled}
              onClick={() => setTool(x.id)}
            >
              {x.icon}
            </RailButton>
          ))}
        </div>
      ))}

      <span className="my-1 w-px shrink-0 bg-hairline/70" aria-hidden />

      {utilities.map((u) => (
        <RailButton
          key={u.key}
          active={u.active}
          label={u.label}
          short={u.short}
          disabled={u.disabled}
          onClick={u.onClick}
        >
          {u.icon}
        </RailButton>
      ))}
    </div>
  )
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
        "flex h-8 w-full items-center justify-center rounded-lg transition-all duration-200 active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
        active
          ? "bg-brand-500 text-ink-950 shadow-sm"
          : "text-ink-300 hover:bg-white/[0.08] hover:text-ink-50",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  )
}

/** 56×52 touch target — comfortably above the 44px minimum, with a caption. */
function RailButton({
  active,
  label,
  short,
  disabled,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  short: string
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
        "flex h-[52px] w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-lg transition-all duration-200 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
        active
          ? "bg-brand-500 text-ink-950 shadow-sm"
          : "bg-surface-0/60 text-ink-200 hover:bg-white/[0.08] hover:text-ink-50",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
      <span className="max-w-full truncate px-0.5 text-[9px] font-semibold leading-none">
        {short}
      </span>
    </button>
  )
}

// ── Timeline & playback ──────────────────────────────────────────────────────

export function Timeline({
  state,
  dispatch,
  playing,
  speed,
  setSpeed,
  loop,
  onToggleLoop,
  onPlay,
  onStop,
  progress,
}: {
  state: EditorState
  dispatch: PlayDispatch
  playing: boolean
  speed: number
  setSpeed: (s: number) => void
  loop: boolean
  onToggleLoop: () => void
  onPlay: () => void
  onStop: () => void
  progress: number
}) {
  const t = useT()
  const { play, frameIdx } = state
  const activeIdx = playing ? Math.min(Math.floor(progress), play.frames.length - 1) : frameIdx
  const SPEEDS = [0.5, 0.75, 1, 1.5, 2]
  const hasDrawings = (play.frames[frameIdx]?.drawings?.length ?? 0) > 0

  const step = (delta: number) => {
    if (playing) return
    dispatch({ type: "set-frame-idx", frameIdx: frameIdx + delta })
  }

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-0 p-1.5 shadow-sm">
      <button
        type="button"
        onClick={playing ? onStop : onPlay}
        disabled={play.frames.length < 2}
        aria-label={playing ? t("playbook.editor.pause") : t("playbook.editor.play")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-ink-950 shadow-sm transition-all hover:bg-brand-400 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>

      {/* Speed: compact cycle button (a native select refuses to shrink and
          crushed the frame chips to zero width) */}
      <button
        type="button"
        onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)}
        title={t("playbook.editor.speed")}
        aria-label={t("playbook.editor.speed")}
        className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-1 font-mono text-[11px] font-bold text-ink-100 transition-all hover:border-hairline-strong hover:text-ink-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
      >
        {speed}×
      </button>

      <button
        type="button"
        onClick={onToggleLoop}
        title={t("playbook.editor.loop")}
        aria-label={t("playbook.editor.loop")}
        aria-pressed={loop}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
          loop
            ? "border-brand-400/50 bg-brand-500/25 text-brand-300"
            : "border-hairline bg-surface-1 text-ink-300 hover:border-hairline-strong hover:text-ink-50",
        )}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11v-1a4 4 0 014-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v1a4 4 0 01-4 4H3" />
        </svg>
      </button>

      <span className="h-5 w-px shrink-0 bg-hairline/60" aria-hidden />

      {/* Step arrows: on a phone these beat aiming at a 7 mm numbered chip. */}
      <FrameButton
        label={t("playbook.editor.prevFrame")}
        disabled={playing || frameIdx === 0}
        onClick={() => step(-1)}
      >
        <IconChevronLeft />
      </FrameButton>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5 scrollbar-thin">
        {play.frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => !playing && dispatch({ type: "set-frame-idx", frameIdx: i })}
            title={f.note || undefined}
            className={cn(
              "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md border px-1.5 font-mono text-[11px] font-bold transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
              i === activeIdx
                ? "border-brand-500 bg-brand-500 text-ink-950 shadow-sm"
                : "border-hairline bg-surface-1 text-ink-200 hover:border-hairline-strong hover:text-ink-50",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <FrameButton
        label={t("playbook.editor.nextFrame")}
        disabled={playing || frameIdx >= play.frames.length - 1}
        onClick={() => step(1)}
      >
        <IconChevronRight />
      </FrameButton>

      <div className="flex shrink-0 items-center gap-1">
        {hasDrawings ? (
          <FrameButton
            label={t("playbook.editor.clearDrawings")}
            disabled={playing}
            danger
            onClick={() => dispatch({ type: "clear-drawings" })}
          >
            <IconPen />
          </FrameButton>
        ) : null}
        <FrameButton
          label={t("playbook.editor.addFrame")}
          disabled={playing}
          onClick={() => dispatch({ type: "add-frame" })}
        >
          <IconPlus />
        </FrameButton>
        <FrameButton
          label={t("playbook.editor.removeFrame")}
          disabled={playing || play.frames.length <= 1}
          danger
          onClick={() => dispatch({ type: "remove-frame" })}
        >
          <IconTrash />
        </FrameButton>
      </div>
    </div>
  )
}

/** Bordered icon button used in the timeline so it clearly reads as a control. */
function FrameButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-1 text-ink-300 transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
        danger
          ? "hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-400"
          : "hover:border-hairline-strong hover:text-ink-50",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  )
}

// ── Icons (16px stroke icons, consistent with the app's inline SVG style) ───

const I = {
  size: 14,
  props: {
    width: 14,
    height: 14,
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
function IconShot() {
  return (
    <svg {...I.props}>
      <path d="M3 20L14 9" />
      <circle cx="17.5" cy="6.5" r="3" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  )
}
function IconChair() {
  return (
    <svg {...I.props}>
      <path d="M7 20V5h10" />
      <path d="M7 13h10" />
    </svg>
  )
}
function IconPen() {
  return (
    <svg {...I.props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
function IconText() {
  return (
    <svg {...I.props}>
      <path d="M5 6V4h14v2" />
      <path d="M12 4v16M9 20h6" />
    </svg>
  )
}
function IconFlip() {
  return (
    <svg {...I.props}>
      <path d="M12 3v18" strokeDasharray="3 3" />
      <path d="M8 8L4 12l4 4" />
      <path d="M16 8l4 4-4 4" />
    </svg>
  )
}
/** Half court = one hoop drawn, full court = a centre line and two. */
function IconCourt({ full }: { full: boolean }) {
  return (
    <svg {...I.props} width={15} height={15}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      {full ? (
        <>
          <path d="M3 12h18" />
          <circle cx="12" cy="12" r="2.2" strokeWidth={1.4} />
        </>
      ) : (
        <path d="M8.5 3v4a3.5 3.5 0 007 0V3" strokeWidth={1.6} />
      )}
    </svg>
  )
}
function IconOrientation({ horizontal }: { horizontal: boolean }) {
  return (
    <svg {...I.props} width={15} height={15}>
      {horizontal ? (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="6.5" cy="12" r="1.2" />
        </>
      ) : (
        <>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <circle cx="12" cy="6.5" r="1.2" />
        </>
      )}
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
function IconChevronLeft() {
  return (
    <svg {...I.props}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
function IconChevronRight() {
  return (
    <svg {...I.props}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}
