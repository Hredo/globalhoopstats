"use client"

import { useState } from "react"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import type { PlayerPercentiles } from "@/lib/scouting/profile"
import { METRIC_KEYS, type Basis, type MetricKey } from "@/lib/scouting/metrics"

const BASES: Basis[] = ["per40pace", "per40", "perGame"]

function format(key: MetricKey, v: number | null): string {
  if (v == null) return "—"
  if (key === "ts" || key === "three") return `${(v * 100).toFixed(1)}%`
  return v.toFixed(1)
}

/**
 * Where a player sits in his own league-season, metric by metric. The three
 * bases are rendered on the server and switched here, so changing basis is
 * instant and costs no request.
 */
export function PercentileProfile({
  data,
  leagueName,
}: {
  data: Partial<Record<Basis, PlayerPercentiles | null>>
  leagueName: string
}) {
  const t = useT()
  const available = BASES.filter((b) => data[b])
  const [basis, setBasis] = useState<Basis>(available[0] ?? "perGame")
  const current = data[basis]
  if (!current) return null

  return (
    <section aria-labelledby="pctl-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pctl-title" className="gh-eyebrow">
            {t("scouting.percentiles.title")}
          </h2>
          <p className="mt-2 text-[13px] text-ink-400">
            {t("scouting.percentiles.lede", { n: current.qualified, league: leagueName, season: current.season })}
          </p>
        </div>
        <div role="group" aria-label={t("scouting.percentiles.basis")} className="inline-flex rounded-lg border border-hairline p-0.5">
          {available.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={basis === b}
              onClick={() => setBasis(b)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                basis === b ? "bg-white/[0.08] text-ink-50" : "text-ink-400 hover:text-ink-100",
              )}
            >
              {t(`scouting.percentiles.${b}`)}
            </button>
          ))}
        </div>
      </div>

      {current.paceMissing ? (
        <p className="mb-3 text-[12px] text-ink-500">{t("scouting.percentiles.paceMissing")}</p>
      ) : null}
      {!current.playerQualifies ? (
        <p className="mb-3 text-[12px] text-amber-300/90">{t("scouting.percentiles.notQualified")}</p>
      ) : null}

      <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {METRIC_KEYS.map((key) => {
          const { value, percentile } = current.profile[key]
          if (value == null) return null
          const p = percentile ?? 0
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink-200">{t(`scouting.percentiles.metrics.${key}`)}</span>
                <span className="font-mono text-[12px] tabular-nums text-ink-400">
                  {format(key, value)}
                  {percentile != null ? (
                    <span className="ml-2 font-semibold text-ink-100">{t("scouting.percentiles.pctl", { n: percentile })}</span>
                  ) : null}
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                {/* Median tick: anything right of it is above the league's middle. */}
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-fluid"
                  style={{
                    width: `${Math.max(2, p)}%`,
                    background:
                      p >= 80
                        ? "var(--color-brand-500)"
                        : p >= 50
                          ? "color-mix(in oklch, var(--color-brand-500) 60%, var(--color-ink-500))"
                          : "var(--color-ink-600)",
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
