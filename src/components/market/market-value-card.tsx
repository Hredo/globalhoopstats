"use client"

import { formatEur } from "@/lib/market/league-strength"
import type { Valuation } from "@/lib/market/valuation"
import { ValuationBadge } from "@/components/market/valuation-badge"
import { useT } from "@/lib/i18n/provider"

export function MarketValueCard({
  valuation,
}: {
  valuation: Valuation
}) {
  const t = useT()
  if (valuation.eur <= 0) return null

  const barWidth = `${valuation.rating}%`
  const confidenceColor =
    valuation.confidence === "high"
      ? "text-emerald-400"
      : valuation.confidence === "medium"
        ? "text-amber-400"
        : "text-ink-400"

  const confidenceLabel =
    valuation.confidence === "high"
      ? t("trade.marketValue.confidenceHigh")
      : valuation.confidence === "medium"
        ? t("trade.marketValue.confidenceMedium")
        : t("trade.marketValue.confidenceLow")

  return (
    <div className="gh-card space-y-3 p-4 text-sm">
      <h3 className="gh-eyebrow">{t("trade.marketValue.title")}</h3>

      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-400">{t("trade.marketValue.estimatedValue")}</span>
        <span className="font-display text-xl font-bold tracking-tight text-ink-50">
          {formatEur(valuation.eur)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
        <span className="text-ink-400">{t("trade.marketValue.annualSalary")}</span>
        <span className="font-semibold text-ink-100">
          {formatEur(valuation.annualEur)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-400">{t("trade.marketValue.category")}</span>
        <ValuationBadge tier={valuation.tier} leagueSlug={valuation.leagueSlug} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-400">{t("trade.marketValue.confidence")}</span>
        <span className={`font-semibold ${confidenceColor}`}>
          {confidenceLabel}
        </span>
      </div>

      <div className="border-t border-hairline pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
            {t("trade.marketValue.rating")}
          </span>
          <span className="font-mono text-xs font-bold text-ink-100">
            {valuation.rating}/100
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-500"
            style={{ width: barWidth }}
          />
        </div>
      </div>

      <details className="group border-t border-hairline pt-2">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 transition hover:text-ink-300">
          {t("trade.marketValue.breakdownTitle")}
        </summary>
        <div className="mt-2 space-y-1.5">
          <BreakdownRow
            label={t("trade.marketValue.breakdownProduction")}
            value={valuation.components.production.toFixed(1)}
          />
          <BreakdownRow
            label={t("trade.marketValue.breakdownEfficiency")}
            value={valuation.components.efficiency.toFixed(1)}
          />
          <BreakdownRow
            label={t("trade.marketValue.breakdownAge")}
            value={`x${valuation.components.ageFactor.toFixed(2)}`}
          />
          <BreakdownRow
            label={t("trade.marketValue.breakdownLeague")}
            value={`x${valuation.components.leagueFactor.toFixed(2)}`}
          />
          <BreakdownRow
            label={t("trade.marketValue.breakdownScarcity")}
            value={`x${valuation.components.scarcity.toFixed(2)}`}
          />
        </div>
      </details>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between font-mono text-[11px]">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-200">{value}</span>
    </div>
  )
}
