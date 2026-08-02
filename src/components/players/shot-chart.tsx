"use client"

import { useState, useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useT } from "@/lib/i18n/provider"
import type { ShotZonesJson, ShotZoneKey } from "@/lib/db/schema"

export type { ShotZonesJson } from "@/lib/db/schema"

type Props = {
  zones: ShotZonesJson | null
}

/* ─────────────────────────── court geometry ─────────────────────────── */
const VB_W = 520
const VB_H = 480
const B = { x: 260, y: 430 }
const R3 = 202.5
const RP = 90
const R_OUT = 250

type Kind = "paint" | "two" | "three"
type ZoneDef = {
  key: ShotZoneKey
  kind: Kind
  a1: number; a2: number; r1: number; r2: number
  labelDeg: number; labelR: number
  order: number
}

const CORNER = [0, 25] as const
const WING = [25, 63] as const
const TOP = [63, 117] as const
const LWING = [117, 155] as const
const LCORNER = [155, 180] as const

const ZONES: ZoneDef[] = [
  { key: "paint", kind: "paint", a1: 0, a2: 180, r1: 0, r2: RP, labelDeg: 90, labelR: 46, order: 0 },
  { key: "rightCorner2", kind: "two", a1: CORNER[0], a2: CORNER[1], r1: RP, r2: R3, labelDeg: 13, labelR: 150, order: 1 },
  { key: "rightWing2", kind: "two", a1: WING[0], a2: WING[1], r1: RP, r2: R3, labelDeg: 44, labelR: 148, order: 1 },
  { key: "frontal2", kind: "two", a1: TOP[0], a2: TOP[1], r1: RP, r2: R3, labelDeg: 90, labelR: 150, order: 1 },
  { key: "leftWing2", kind: "two", a1: LWING[0], a2: LWING[1], r1: RP, r2: R3, labelDeg: 136, labelR: 148, order: 1 },
  { key: "leftCorner2", kind: "two", a1: LCORNER[0], a2: LCORNER[1], r1: RP, r2: R3, labelDeg: 167, labelR: 150, order: 1 },
  { key: "rightCorner3", kind: "three", a1: CORNER[0], a2: CORNER[1], r1: R3, r2: R_OUT, labelDeg: 11, labelR: 224, order: 2 },
  { key: "rightWing3", kind: "three", a1: WING[0], a2: WING[1], r1: R3, r2: R_OUT, labelDeg: 44, labelR: 228, order: 2 },
  { key: "frontal3", kind: "three", a1: TOP[0], a2: TOP[1], r1: R3, r2: R_OUT, labelDeg: 90, labelR: 230, order: 2 },
  { key: "leftWing3", kind: "three", a1: LWING[0], a2: LWING[1], r1: R3, r2: R_OUT, labelDeg: 136, labelR: 228, order: 2 },
  { key: "leftCorner3", kind: "three", a1: LCORNER[0], a2: LCORNER[1], r1: R3, r2: R_OUT, labelDeg: 169, labelR: 224, order: 2 },
]

function pt(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [
    Math.round((B.x + r * Math.cos(rad)) * 100) / 100,
    Math.round((B.y - r * Math.sin(rad)) * 100) / 100,
  ]
}

function wedgePath(a1: number, a2: number, r1: number, r2: number): string {
  const steps = Math.max(2, Math.round(Math.abs(a2 - a1) / 4))
  const outer: string[] = []
  const inner: string[] = []
  for (let i = 0; i <= steps; i++) {
    const a = a1 + ((a2 - a1) * i) / steps
    const [ox, oy] = pt(a, r2)
    outer.push(`${ox.toFixed(1)} ${oy.toFixed(1)}`)
    const [ix, iy] = pt(a, r1)
    inner.unshift(`${ix.toFixed(1)} ${iy.toFixed(1)}`)
  }
  return `M ${outer.join(" L ")} L ${inner.join(" L ")} Z`
}

/* ─────────────────────── 4-colour buckets ──────────────────── */
const PCT_COLORS = [
  { max: 0.24, color: "oklch(58% 0.18 25)" },
  { max: 0.49, color: "oklch(68% 0.16 55)" },
  { max: 0.74, color: "oklch(62% 0.14 165)" },
  { max: 1, color: "oklch(58% 0.14 255)" },
]

function bucketColor(pct: number | null): string {
  if (pct == null) return "oklch(38% 0.008 260)"
  for (const b of PCT_COLORS) {
    if (pct <= b.max) return b.color
  }
  return PCT_COLORS[3]!.color
}

function formatPct(v: number | null): string {
  return v == null ? "\u2014" : `${Math.round(v * 100)}%`
}

const easing: [number, number, number, number] = [0.16, 1, 0.3, 1]

type Cell = {
  def: ZoneDef
  pct: number | null
  made: number
  att: number
  fill: string
  opacity: number
  label: [number, number]
}

export function ShotChart({ zones }: Props) {
  const t = useT()
  const reduce = useReducedMotion()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const { cells, maxAtt, totalAtt } = useMemo(() => {
    const maxAtt = Math.max(1, ...ZONES.map((z) => zones?.[z.key]?.a ?? 0))
    const cells: Cell[] = ZONES.map((def) => {
      const z = zones?.[def.key]
      const att = z?.a ?? 0
      const made = z?.m ?? 0
      const pct = att > 0 ? made / att : null
      return {
        def,
        pct,
        made,
        att,
        fill: bucketColor(pct),
        opacity: att === 0 ? 0.12 : 0.42 + 0.5 * Math.min(1, att / maxAtt),
        label: pt(def.labelDeg, def.labelR),
      }
    })
    const totalAtt = cells.reduce((sum, c) => sum + c.att, 0)
    return { cells, maxAtt, totalAtt }
  }, [zones])

  const hasData = zones != null && totalAtt > 0

  return (
    <div className="gh-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4">
        <h3 className="gh-eyebrow">{t("playerProfile.shotChart")}</h3>
        {hasData ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            {t("playerProfile.shotVolume", { count: totalAtt })}
          </span>
        ) : null}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink-600" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M5 8c3 2 11 2 14 0M5 16c3-2 11-2 14 0M12 3v18" />
          </svg>
          <p className="text-sm font-medium text-ink-300">{t("playerProfile.shotNoData")}</p>
          <p className="max-w-xs text-xs leading-relaxed text-ink-500">{t("playerProfile.shotNoDataHint")}</p>
        </div>
      ) : (
        <div className="px-3 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-[560px]">
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="h-auto w-full"
              role="img"
              aria-label={t("playerProfile.shotChart")}
            >
              <defs>
                <clipPath id="sc-court">
                  <rect x="30" y="8" width="460" height="424" rx="6" />
                </clipPath>
                <filter id="zone-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="sc-floor" cx="50%" cy="92%" r="80%">
                  <stop offset="0%" stopColor="oklch(35% 0.04 65 / 0.5)" />
                  <stop offset="60%" stopColor="oklch(26% 0.03 62 / 0.4)" />
                  <stop offset="100%" stopColor="oklch(18% 0.025 58 / 0.35)" />
                </radialGradient>
                <radialGradient id="sc-center-glow" cx="50%" cy="85%" r="35%">
                  <stop offset="0%" stopColor="oklch(90% 0.04 60 / 0.08)" />
                  <stop offset="100%" stopColor="oklch(90% 0.04 60 / 0)" />
                </radialGradient>
              </defs>

              <rect x="30" y="8" width="460" height="424" rx="6" fill="url(#sc-floor)" stroke="oklch(55% 0.03 65 / 0.2)" strokeWidth="1" />
              <rect x="30" y="8" width="460" height="424" rx="6" fill="url(#sc-center-glow)" />

              <g clipPath="url(#sc-court)">
                {cells.map((c) => {
                  const d =
                    c.def.kind === "paint"
                      ? wedgePath(0, 180, 0, RP)
                      : wedgePath(c.def.a1, c.def.a2, c.def.r1, c.def.r2)
                  const isHovered = hoveredKey === c.def.key
                  return (
                    <motion.path
                      key={c.def.key}
                      d={d}
                      fill={c.fill}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{
                        opacity: isHovered ? Math.min(1, c.opacity + 0.2) : c.opacity,
                        filter: isHovered ? "url(#zone-glow)" : "none",
                      }}
                      transition={{
                        opacity: { duration: 0.4, ease: easing, delay: reduce ? 0 : 0.08 + c.def.order * 0.1 },
                        filter: { duration: 0.25 },
                      }}
                      stroke={isHovered ? c.fill : "oklch(96% 0.01 80 / 0.06)"}
                      strokeWidth={isHovered ? 2 : 1}
                      onMouseEnter={() => setHoveredKey(c.def.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={{ cursor: "pointer" }}
                    />
                  )
                })}
              </g>

              <g fill="none" stroke="oklch(92% 0.015 75 / 0.5)" strokeWidth="1.6" strokeLinecap="round">
                <path d={`M ${pt(LCORNER[1], R3)[0].toFixed(1)} ${pt(LCORNER[1], R3)[1].toFixed(1)} A ${R3} ${R3} 0 0 1 ${pt(CORNER[1], R3)[0].toFixed(1)} ${pt(CORNER[1], R3)[1].toFixed(1)}`} />
                <line x1={pt(CORNER[1], R3)[0]} y1={pt(CORNER[1], R3)[1]} x2={pt(CORNER[1], R_OUT + 30)[0]} y2={pt(CORNER[1], R_OUT + 30)[1]} />
                <line x1={pt(LCORNER[1], R3)[0]} y1={pt(LCORNER[1], R3)[1]} x2={pt(LCORNER[1], R_OUT + 30)[0]} y2={pt(LCORNER[1], R_OUT + 30)[1]} />
                <rect x="186" y="256" width="148" height="174" />
                <path d="M 206 256 A 54 54 0 0 1 314 256" />
                <path d="M 206 256 A 54 54 0 0 0 314 256" strokeDasharray="4 5" opacity="0.4" />
                <circle cx={B.x} cy={B.y - 6} r="10" stroke="oklch(92% 0.04 60 / 0.08)" strokeWidth="3" />
                <circle cx={B.x} cy={B.y - 6} r="8" stroke="oklch(92% 0.015 75 / 0.7)" strokeWidth="1.8" />
                <line x1="240" y1={B.y + 4} x2="280" y2={B.y + 4} strokeWidth="2.4" />
                <line x1="30" y1="8" x2="490" y2="8" opacity="0.5" />
                <path d="M 206 8 A 54 54 0 0 1 314 8" opacity="0.5" />
              </g>

              <g stroke="oklch(92% 0.015 75 / 0.12)" strokeWidth="0.8" fill="none">
                {[0, 30, 60, 90, 120, 150].map((a) => {
                  const rad = (a * Math.PI) / 180
                  const x1 = B.x + 8 * Math.cos(rad)
                  const y1 = B.y - 6 + 8 * Math.sin(rad)
                  const x2 = B.x + 18 * Math.cos(rad)
                  const y2 = B.y + 6 + 18 * Math.sin(rad)
                  return <line key={`net-${a}`} x1={x1} y1={y1} x2={x2} y2={y2} />
                })}
              </g>

              {cells.map((c) => {
                const [lx, ly] = c.label
                const strong = c.att >= Math.max(4, maxAtt * 0.25)
                const isHovered = hoveredKey === c.def.key
                return (
                  <g
                    key={`lbl-${c.def.key}`}
                    opacity={isHovered || !hoveredKey ? 1 : 0.3}
                    style={{ transition: "opacity 0.25s ease" }}
                  >
                    <rect
                      x={lx - 26}
                      y={ly - 15}
                      width="52"
                      height="30"
                      rx="7"
                      fill={isHovered ? "oklch(12% 0.025 280 / 0.92)" : "oklch(14% 0.02 280 / 0.82)"}
                      stroke={isHovered ? c.fill : strong ? c.fill : "oklch(60% 0.02 280 / 0.25)"}
                      strokeWidth={isHovered ? 2 : strong ? 1.4 : 0.8}
                    />
                    <text
                      x={lx}
                      y={ly - 1}
                      textAnchor="middle"
                      fontSize="15"
                      fontWeight="800"
                      fontFamily="var(--font-mono, ui-monospace), monospace"
                      fill={c.pct == null ? "oklch(60% 0.01 80 / 0.6)" : "oklch(97% 0.01 80)"}
                    >
                      {formatPct(c.pct)}
                    </text>
                    <text
                      x={lx}
                      y={ly + 11}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="600"
                      fontFamily="var(--font-mono, ui-monospace), monospace"
                      fill={isHovered ? "oklch(85% 0.02 70 / 0.9)" : "oklch(72% 0.01 80 / 0.65)"}
                    >
                      {c.att > 0 ? `${c.made}/${c.att}` : "\u2014"}
                    </text>
                  </g>
                )
              })}
            </svg>

            <div className="mx-auto mt-5 flex w-full max-w-[560px] items-center gap-2">
              {PCT_COLORS.map((b, i) => (
                <div key={i} className="flex flex-1 items-center gap-1.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded"
                    style={{ background: b.color }}
                  />
                  <span className="font-mono text-[10px] text-ink-500">
                    {i === 0 ? "0\u201324%" : i === 1 ? "25\u201349%" : i === 2 ? "50\u201374%" : "75\u2013100%"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
