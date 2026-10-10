"use client"

import { useEffect, useId, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { ComparePlayer } from "@/lib/data/compare"
import { useT } from "@/lib/i18n/provider"
import type { PercentileProfile } from "@/lib/scouting/metrics"
import { cn } from "@/components/ui/cn"

type Props = {
  a: ComparePlayer
  b: ComparePlayer
  /**
   * League-season percentiles (per 40, pace-adjusted). When both are present
   * the radar can switch to them: the only fair way to put a FEB player and
   * an ACB player on one chart.
   */
  percentiles?: { a: PercentileProfile | null; b: PercentileProfile | null }
}

/** Which percentile(s) feed each radar axis. */
const PCTL_AXIS: Record<string, Array<keyof PercentileProfile>> = {
  scoring: ["pts"],
  playmaking: ["ast"],
  rebounding: ["reb"],
  defense: ["stl", "blk"],
  efficiency: ["per"],
  shooting: ["ts"],
}

function pctlValue(profile: PercentileProfile, axis: string): number {
  const vals = (PCTL_AXIS[axis] ?? [])
    .map((k) => profile[k]?.percentile)
    .filter((v): v is number => v != null)
  return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length / 100 : 0
}

type Axis = {
  key: string
  labelKey: string
  max: number
  pick: (p: ComparePlayer) => number | null
}

const AXES: Axis[] = [
  {
    key: "scoring",
    labelKey: "compareUi.radar.scoring",
    max: 32,
    pick: (p) =>
      num(
        p.stats != null
          ? (p.stats.pointsTotal ?? 0) / (p.stats.gamesPlayed || 1)
          : null,
      ),
  },
  {
    key: "playmaking",
    labelKey: "compareUi.radar.assists",
    max: 11,
    pick: (p) =>
      num(
        p.stats != null
          ? (p.stats.assistsTotal ?? 0) / (p.stats.gamesPlayed || 1)
          : null,
      ),
  },
  {
    key: "rebounding",
    labelKey: "compareUi.radar.rebounding",
    max: 13,
    pick: (p) =>
      num(
        p.stats != null
          ? (p.stats.reboundsTotal ?? 0) / (p.stats.gamesPlayed || 1)
          : null,
      ),
  },
  {
    key: "defense",
    labelKey: "compareUi.radar.defense",
    max: 4.5,
    pick: (p) => {
      if (!p.stats) return null
      const st = p.stats
      return sumOrNull(
        num(st.stealsTotal != null ? st.stealsTotal / (st.gamesPlayed || 1) : null),
        num(st.blocksTotal != null ? st.blocksTotal / (st.gamesPlayed || 1) : null),
      )
    },
  },
  {
    key: "efficiency",
    labelKey: "compareUi.radar.per",
    max: 35,
    pick: (p) => num(p.stats?.per),
  },
  {
    key: "shooting",
    labelKey: "compareUi.radar.shooting",
    max: 0.65,
    pick: (p) => {
      if (!p.stats) return null
      const fg = p.stats.fgPct
      const three = p.stats.threePct
      const ft = p.stats.ftPct
      const vals = [fg, three, ft].filter((v): v is number => v != null)
      if (vals.length === 0) return null
      return vals.reduce((a, b) => a + b, 0) / vals.length
    },
  },
]

const CX = 200
const CY = 200
const R = 130

function num(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v
}

function sumOrNull(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null
  return (a ?? 0) + (b ?? 0)
}

function pointFor(i: number, value: number) {
  const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2
  return [
    CX + Math.cos(angle) * R * value,
    CY + Math.sin(angle) * R * value,
  ] as const
}

function polygonFromValues(values: number[]) {
  return values
    .map((v, i) => {
      const [x, y] = pointFor(i, v)
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .concat("Z")
    .join(" ")
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

export function CompareRadar({ a, b, percentiles }: Props) {
  const t = useT()
  const reduce = useReducedMotion()
  const aId = useId()
  const bId = useId()
  const canPctl = !!(percentiles?.a && percentiles?.b)
  const [mode, setMode] = useState<"absolute" | "percentile">(canPctl ? "percentile" : "absolute")
  const usePctl = mode === "percentile" && canPctl
  const aValues = AXES.map((ax) => {
    if (usePctl) return pctlValue(percentiles!.a!, ax.key)
    const raw = ax.pick(a)
    return raw == null ? 0 : clamp01(raw / ax.max)
  })
  const bValues = AXES.map((ax) => {
    if (usePctl) return pctlValue(percentiles!.b!, ax.key)
    const raw = ax.pick(b)
    return raw == null ? 0 : clamp01(raw / ax.max)
  })
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200)
    return () => clearTimeout(timer)
  }, [])

  const centerPath = polygonFromValues(AXES.map(() => 0))
  const aPath = polygonFromValues(aValues)
  const bPath = polygonFromValues(bValues)

  return (
    <div className="relative h-full w-full">
      {canPctl ? (
        <div className="absolute left-0 top-0 z-10 flex flex-col items-start gap-1.5">
          <div role="group" className="inline-flex rounded-lg border border-hairline bg-surface-1/80 p-0.5 backdrop-blur">
            {(["percentile", "absolute"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  mode === m ? "bg-white/[0.08] text-ink-50" : "text-ink-400 hover:text-ink-100",
                )}
              >
                {t(`scouting.radarMode.${m}`)}
              </button>
            ))}
          </div>
          {usePctl ? (
            <p className="max-w-[220px] text-[10.5px] leading-snug text-ink-500">{t("scouting.radarMode.percentileHint")}</p>
          ) : null}
        </div>
      ) : null}
      <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label={t("compareUi.radarAria", { a: a.fullName, b: b.fullName })}
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={aId} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-brand-400)"
              stopOpacity="0.65"
            />
            <stop
              offset="100%"
              stopColor="var(--color-brand-500)"
              stopOpacity="0.15"
            />
          </linearGradient>
          <linearGradient id={bId} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-accent-cyan)"
              stopOpacity="0.6"
            />
            <stop
              offset="100%"
              stopColor="var(--color-accent-cyan)"
              stopOpacity="0.1"
            />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((tick) => (
          <polygon
            key={tick}
            points={AXES.map((_, i) => {
              const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2
              return `${CX + Math.cos(angle) * R * tick},${CY + Math.sin(angle) * R * tick}`
            }).join(" ")}
            fill="none"
            stroke="var(--color-ink-700)"
            strokeWidth="0.6"
            strokeDasharray="2 4"
            opacity="0.5"
          />
        ))}

        {AXES.map((_, i) => {
          const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={CX + Math.cos(angle) * R}
              y2={CY + Math.sin(angle) * R}
              stroke="var(--color-ink-700)"
              strokeWidth="0.5"
              opacity="0.5"
            />
          )
        })}

        <motion.path
          d={show || reduce ? aPath : centerPath}
          fill={`url(#${aId})`}
          animate={{ d: aPath }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
        />
        <motion.path
          d={show || reduce ? aPath : centerPath}
          fill="none"
          stroke="var(--color-brand-400)"
          strokeWidth="2"
          strokeLinejoin="round"
          animate={{ d: aPath }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
        />

        <motion.path
          d={show || reduce ? bPath : centerPath}
          fill={`url(#${bId})`}
          animate={{ d: bPath }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
        />
        <motion.path
          d={show || reduce ? bPath : centerPath}
          fill="none"
          stroke="var(--color-accent-cyan)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeDasharray="4 4"
          animate={{ d: bPath }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
        />

        {AXES.map((axis, i) => {
          const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2
          const lx = CX + Math.cos(angle) * (R + 26)
          const ly = CY + Math.sin(angle) * (R + 26)
          return (
            <text
              key={axis.key}
              x={lx}
              y={ly}
              fontSize="11"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--color-ink-200)"
              fontFamily="var(--font-mono)"
            >
              {t(axis.labelKey)}
            </text>
          )
        })}

        {AXES.map((axis, i) => {
          const [px, py] = pointFor(i, aValues[i])
          return (
            <circle
              key={`a-${axis.key}`}
              cx={px}
              cy={py}
              r="3"
              fill="var(--color-brand-300)"
            />
          )
        })}

        {AXES.map((axis, i) => {
          const [px, py] = pointFor(i, bValues[i])
          return (
            <circle
              key={`b-${axis.key}`}
              cx={px}
              cy={py}
              r="3"
              fill="var(--color-accent-cyan)"
            />
          )
        })}
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="absolute left-3 top-3 flex items-center gap-3 text-[11px] font-medium text-ink-200"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-400" />
          <span className="max-w-[100px] truncate sm:max-w-[140px]">
            {a.fullName}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent-cyan" />
          <span className="max-w-[100px] truncate sm:max-w-[140px]">
            {b.fullName}
          </span>
        </span>
      </motion.div>
    </div>
  )
}

export default CompareRadar
