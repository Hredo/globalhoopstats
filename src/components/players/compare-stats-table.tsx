"use client"

import type { ComparePlayer, CompareStats } from "@/lib/data/compare"
import { useT } from "@/lib/i18n/provider"

type Props = {
  a: ComparePlayer
  b: ComparePlayer
}

type StatRow = {
  labelKey: string
  getValue: (s: CompareStats) => number | null
  fmt: (n: number) => string
  higherBetter?: boolean
  isPct?: boolean
}

type StatGroup = {
  labelKey: string
  rows: StatRow[]
}

function perGame(total: number | null, gp: number): number | null {
  if (total == null || gp === 0) return null
  return total / gp
}

function pct(made: number | null, att: number | null): number | null {
  if (made == null || att == null || att === 0) return null
  return made / att
}

const GROUPS: StatGroup[] = [
  {
    labelKey: "compareUi.groupScoring",
    rows: [
      {
        labelKey: "compareUi.rowPoints",
        getValue: (s) => perGame(s.pointsTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowFg",
        getValue: (s) => pct(s.fgMade, s.fgAttempted),
        fmt: (n) => `${(n * 100).toFixed(1)}%`,
        isPct: true,
      },
      {
        labelKey: "compareUi.row3p",
        getValue: (s) => pct(s.threeMade, s.threeAttempted),
        fmt: (n) => `${(n * 100).toFixed(1)}%`,
        isPct: true,
      },
      {
        labelKey: "compareUi.rowFt",
        getValue: (s) => pct(s.ftMade, s.ftAttempted),
        fmt: (n) => `${(n * 100).toFixed(1)}%`,
        isPct: true,
      },
    ],
  },
  {
    labelKey: "compareUi.groupRebounding",
    rows: [
      {
        labelKey: "compareUi.rowRebounds",
        getValue: (s) => perGame(s.reboundsTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowOffReb",
        getValue: (s) => perGame(s.offensiveRebounds, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowDefReb",
        getValue: (s) => perGame(s.defensiveRebounds, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
    ],
  },
  {
    labelKey: "compareUi.groupPlaymaking",
    rows: [
      {
        labelKey: "compareUi.rowAssists",
        getValue: (s) => perGame(s.assistsTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowFouls",
        getValue: (s) => perGame(s.foulsTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
    ],
  },
  {
    labelKey: "compareUi.groupDefense",
    rows: [
      {
        labelKey: "compareUi.rowSteals",
        getValue: (s) => perGame(s.stealsTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowBlocks",
        getValue: (s) => perGame(s.blocksTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
    ],
  },
  {
    labelKey: "compareUi.groupHustle",
    rows: [
      {
        labelKey: "compareUi.rowFouls",
        getValue: (s) => perGame(s.foulsTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
        higherBetter: false,
      },
    ],
  },
  {
    labelKey: "compareUi.groupEfficiency",
    rows: [
      {
        labelKey: "compareUi.rowPer",
        getValue: (s) => s.per,
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowMinutes",
        getValue: (s) => perGame(s.minutesTotal, s.gamesPlayed),
        fmt: (n) => n.toFixed(1),
      },
      {
        labelKey: "compareUi.rowPlusMinus",
        getValue: (s) => perGame(s.plusMinus, s.gamesPlayed),
        fmt: (n) => {
          const sign = n >= 0 ? "+" : ""
          return `${sign}${n.toFixed(1)}`
        },
      },
    ],
  },
]

function compareValues(a: number | null, b: number | null, higherBetter: boolean): "a" | "b" | "tie" | "n/a" {
  if (a == null && b == null) return "n/a"
  if (a == null) return "b"
  if (b == null) return "a"
  const diff = higherBetter ? a - b : b - a
  if (Math.abs(diff) < 0.001) return "tie"
  return diff > 0 ? "a" : "b"
}

export function CompareStatsTable({ a, b }: Props) {
  const aName = a.fullName
  const bName = b.fullName

  return (
    <div className="w-full">
      <div className="mb-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 px-1 text-[10px] font-mono uppercase tracking-widest text-ink-500">
        <div />
        <div className="text-right">{aName}</div>
        <div className="w-6 text-center" />
        <div className="text-left">{bName}</div>
      </div>
      {GROUPS.map((group) => (
        <GroupSection
          key={group.labelKey}
          group={group}
          aStats={a.stats}
          bStats={b.stats}
        />
      ))}
      <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 px-1 text-[10px] font-mono uppercase tracking-widest text-ink-500">
        <div />
        <div className="text-right">{aName}</div>
        <div className="w-6 text-center" />
        <div className="text-left">{bName}</div>
      </div>
    </div>
  )
}

function GroupSection({
  group,
  aStats,
  bStats,
}: {
  group: StatGroup
  aStats: CompareStats | null
  bStats: CompareStats | null
}) {
  const t = useT()
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="h-px flex-1 bg-white/5" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-400">
          {t(group.labelKey)}
        </span>
        <span className="h-px flex-1 bg-white/5" />
      </div>
      <div className="space-y-px">
        {group.rows.map((row) => {
          const av = aStats ? row.getValue(aStats) : null
          const bv = bStats ? row.getValue(bStats) : null
          const winner = compareValues(av, bv, row.higherBetter ?? true)
          return (
            <div
              key={row.labelKey}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-white/[0.02]"
            >
              <span className="text-ink-300">{t(row.labelKey)}</span>
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={`font-mono tabular-nums ${
                    winner === "a" ? "text-brand-300 font-semibold" : "text-ink-200"
                  }`}
                >
                  {av != null ? row.fmt(av) : "—"}
                </span>
                {row.isPct && av != null ? (
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all"
                      style={{ width: `${Math.min(av * 100, 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
              <span className="w-6 text-center text-[10px] text-ink-500">
                {winner === "a"
                  ? "▲"
                  : winner === "b"
                    ? "▼"
                    : winner === "tie"
                      ? "—"
                      : ""}
              </span>
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className={`font-mono tabular-nums ${
                    winner === "b" ? "text-accent-cyan font-semibold" : "text-ink-200"
                  }`}
                >
                  {bv != null ? row.fmt(bv) : "—"}
                </span>
                {row.isPct && bv != null ? (
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-cyan-300 transition-all"
                      style={{ width: `${Math.min(bv * 100, 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
