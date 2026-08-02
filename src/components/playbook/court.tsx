import { COURT_WIDTH_M, type CourtType } from "@/lib/playbook/types"
import { FIBA, courtLength, threeBreakY } from "@/lib/playbook/geometry"

/**
 * The whiteboard palette is fixed (not theme tokens) on purpose: the board
 * reads as a real coaching whiteboard in both themes AND serializes cleanly
 * to PNG without resolving CSS variables.
 */
export const BOARD = {
  floor: "#f2ede2",
  floorGrain: "#ece6d8",
  key: "#e6dcc8",
  lines: "#6f5f4a",
  linesFaded: "#8a7b68",
  action: "#141414",
  attacker: "#b93a08",
  defender: "#33425c",
  ball: "#d97706",
  cone: "#dc2626",
  coach: "#5f5185",
  selected: "#0d9488",
  note: "#6b6154",
}

/**
 * Regulation FIBA court drawn to scale in court metres (the parent <g> is
 * scaled to pixels by the editor). Half court renders the hoop at the top;
 * full court adds the mirrored far half. Pure presentational SVG.
 */
export function PlaybookCourt({ courtType }: { courtType: CourtType }) {
  const W = COURT_WIDTH_M
  const L = courtLength(courtType)
  const breakY = threeBreakY()

  return (
    <g
      stroke={BOARD.lines}
      strokeWidth={0.06}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* floor — subtle wood grain lines */}
      <rect x={0} y={0} width={W} height={L} fill={BOARD.floor} stroke="none" rx={0.1} />
      {Array.from({ length: Math.ceil(L / 0.5) }).map((_, i) => (
        <line key={i} x1={0} y1={i * 0.5 + 0.15} x2={W} y2={i * 0.5 + 0.15}
          stroke={BOARD.floorGrain} strokeWidth={0.015} opacity={0.4} />
      ))}
      {/* boundary with inner highlight */}
      <rect x={0} y={0} width={W} height={L} strokeWidth={0.1} rx={0.1} />
      <rect x={0.06} y={0.06} width={W - 0.12} height={L - 0.12} stroke={BOARD.linesFaded} strokeWidth={0.02} rx={0.08} opacity={0.5} />
      <NearHalf breakY={breakY} />
      {/* subtle court shadow — bottom edge */}
      <rect x={0.04} y={L - 0.04} width={W - 0.08} height={0.08} fill="#000" opacity={0.04} rx={0.02} />
      {courtType === "full" ? (
        <>
          {/* half-court line + centre circle */}
          <line x1={0} y1={L / 2} x2={W} y2={L / 2} />
          <circle cx={W / 2} cy={L / 2} r={FIBA.centerCircleRadius} />
          <g transform={`translate(${W} ${L}) rotate(180)`}>
            <NearHalf breakY={breakY} />
          </g>
        </>
      ) : (
        <>
          {/* half centre circle against the bottom edge */}
          <path
            d={`M ${W / 2 - FIBA.centerCircleRadius} ${L} A ${FIBA.centerCircleRadius} ${FIBA.centerCircleRadius} 0 0 1 ${W / 2 + FIBA.centerCircleRadius} ${L}`}
          />
        </>
      )}
    </g>
  )
}

/** One end of the court: key, circles, backboard, rim and three-point line. */
function NearHalf({ breakY }: { breakY: number }) {
  const W = COURT_WIDTH_M
  const cx = W / 2
  const rimY = FIBA.rimFromBaseline
  const keyHalf = FIBA.keyWidth / 2
  const r3 = FIBA.threeRadius
  const inset = FIBA.cornerThreeInset
  const dx = cx - inset

  return (
    <g>
      {/* key */}
      <rect
        x={cx - keyHalf}
        y={0}
        width={FIBA.keyWidth}
        height={FIBA.keyDepth}
        fill={BOARD.key}
      />
      {/* free-throw circle */}
      <circle cx={cx} cy={FIBA.keyDepth} r={FIBA.ftCircleRadius} />
      {/* backboard */}
      <line
        x1={cx - 0.9}
        y1={FIBA.backboardFromBaseline}
        x2={cx + 0.9}
        y2={FIBA.backboardFromBaseline}
        strokeWidth={0.09}
      />
      {/* rim */}
      <circle cx={cx} cy={rimY} r={0.23} strokeWidth={0.05} />
      {/* restricted area */}
      <path
        d={`M ${cx - FIBA.restrictedRadius} ${rimY} A ${FIBA.restrictedRadius} ${FIBA.restrictedRadius} 0 0 0 ${cx + FIBA.restrictedRadius} ${rimY}`}
      />
      {/* three-point line: corner segments + arc */}
      <line x1={inset} y1={0} x2={inset} y2={breakY} />
      <line x1={W - inset} y1={0} x2={W - inset} y2={breakY} />
      <path d={`M ${cx - dx} ${breakY} A ${r3} ${r3} 0 0 0 ${cx + dx} ${breakY}`} />
    </g>
  )
}
