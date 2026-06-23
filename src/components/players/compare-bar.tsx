import { AnimatedBar } from "@/components/animations/animated-bar"

type Props = {
  label: string
  aName: string
  bName: string
  a: number | null
  b: number | null
  max: number
  fmt: (n: number) => string
  lowerBetter?: boolean
}

function safePct(value: number | null, max: number): number {
  if (value == null) return 0
  const safeMax = max > 0 ? max : 1
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, (value / safeMax) * 100))
}

export function CompareBar({
  label,
  aName,
  bName,
  a,
  b,
  max,
  fmt,
  lowerBetter = false,
}: Props) {
  const aPct = safePct(a, max)
  const bPct = safePct(b, max)
  const aWins = a != null && b != null && (lowerBetter ? a < b : a > b)
  const bWins = a != null && b != null && (lowerBetter ? b < a : b > a)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-ink-300">
          {label}
        </span>
        <span className="font-mono text-ink-200">
          <span className={a == null ? "text-ink-500" : ""}>
            {a != null ? fmt(a) : "—"}
          </span>{" "}
          <span className="text-ink-500">·</span>{" "}
          <span className={b == null ? "text-ink-500" : ""}>
            {b != null ? fmt(b) : "—"}
          </span>
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-20 truncate text-[10px] text-ink-400 sm:w-32">
            {aName}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            {a != null ? (
              <AnimatedBar
                value={aPct}
                max={100}
                delay={0.1}
                duration={0.6}
                color={aWins ? "bg-gradient-to-r from-accent-lime to-brand-400" : "bg-brand-500/60"}
              />
            ) : (
              <div className="h-full rounded-full bg-white/10" style={{ width: "100%" }} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 truncate text-[10px] text-ink-400 sm:w-32">
            {bName}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            {b != null ? (
              <AnimatedBar
                value={bPct}
                max={100}
                delay={0.2}
                duration={0.6}
                color={bWins ? "bg-gradient-to-r from-accent-lime to-brand-400" : "bg-brand-500/60"}
              />
            ) : (
              <div className="h-full rounded-full bg-white/10" style={{ width: "100%" }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
