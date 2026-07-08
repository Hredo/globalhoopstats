"use client"

import { motion } from "framer-motion"
import { formatCurrency, type CurrencyCode } from "@/lib/market/currency"
import type { Valuation } from "@/lib/market/valuation"
import { SmartImage } from "@/components/ui/smart-image"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { ValuationBadge } from "@/components/market/valuation-badge"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"
import { useT } from "@/lib/i18n/provider"

function SparkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  )
}

type PerGameStats = {
  pointsPerGame: number | null
  reboundsPerGame: number | null
  assistsPerGame: number | null
  stealsPerGame: number | null
  blocksPerGame: number | null
  fgPct: number | null
  threePct: number | null
  ftPct: number | null
  per: number | null
  gamesPlayed: number | null
}

type IncomingPlayer = {
  slug: string
  name: string
  position: string | null
  age: number | null
  league: { slug: string; name: string }
  team: { name: string; logoUrl: string | null } | null
  imageUrl: string | null
  valuation: Valuation
  stats: PerGameStats | null
}

function StatsRow({ stats }: { stats: PerGameStats | null | undefined }) {
  const t = useT()
  if (!stats) return null
  const items = [
    { label: t("trade.stats.pts"), value: stats.pointsPerGame },
    { label: t("trade.stats.reb"), value: stats.reboundsPerGame },
    { label: t("trade.stats.ast"), value: stats.assistsPerGame },
    { label: t("trade.stats.per"), value: stats.per },
  ].filter((x) => x.value != null)
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[9px] text-ink-400">
      {items.map((x) => (
        <span key={x.label} className="whitespace-nowrap">
          {x.label}: <strong className="text-ink-300">{typeof x.value === "number" ? x.value.toFixed(1) : "—"}</strong>
        </span>
      ))}
    </div>
  )
}

type Props = {
  scenario: {
    combinedValueEur: number
    balance: number
    verdict: string
    incoming: IncomingPlayer[]
  }
  outgoingName: string
  outgoingValue: number
  currency?: CurrencyCode
  onAnalyze?: () => void
  aiLoading?: boolean
  aiAnalysis?: string | null
  aiError?: string | null
}

export function TradeScenarioCard({
  scenario,
  outgoingName,
  outgoingValue,
  currency = "EUR",
  onAnalyze,
  aiLoading = false,
  aiAnalysis = null,
  aiError = null,
}: Props) {
  const t = useT()
  const isBalanced =
    scenario.balance >= 0.95 && scenario.balance <= 1.08
  const color = isBalanced
    ? "border-emerald-500/30"
    : scenario.balance < 0.95
      ? "border-amber-500/30"
      : "border-amber-500/30"

  return (
    <motion.div
      className={`gh-card overflow-hidden border-l-2 ${color}`}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
    >
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="gh-eyebrow">{t("trade.packageLabel", { count: scenario.incoming.length })}</span>
            <span className="font-display text-lg font-bold text-ink-50">
            {formatCurrency(scenario.combinedValueEur, currency)}
          </span>
        </div>

        <div className="space-y-2">
          {scenario.incoming.map((p) => (
            <div
              key={p.slug}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-surface-0 p-2.5"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-court-800">
                <SmartImage
                  src={p.imageUrl}
                  alt={p.name}
                  fit="cover"
                  fallback={
                    <PersonAvatar name={p.name} leagueSlug={p.league.slug} />
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-100">
                  {p.name}
                </p>
                <div className="flex items-center gap-2 font-mono text-[10px] text-ink-400">
                  <span>{p.position ?? "—"}</span>
                  <span>·</span>
                  <span>{p.team?.name ?? "FA"}</span>
                </div>
                {p.stats ? <StatsRow stats={p.stats} /> : null}
              </div>
              <div className="text-right">
                <p className="font-display text-sm font-bold text-ink-50">
                  {formatCurrency(p.valuation.eur, currency)}
                </p>
                <ValuationBadge tier={p.valuation.tier} leagueSlug={p.league.slug} />
              </div>
            </div>
          ))}
        </div>

          <div className="mt-4 border-t border-hairline pt-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-ink-400">
                {outgoingName}: {formatCurrency(outgoingValue, currency)}
              </span>
              <motion.span
                className="font-bold text-ink-100"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              >
                {t("trade.scenarioCard.balance")}: {scenario.balance.toFixed(2)}
              </motion.span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`h-full rounded-full ${
                  isBalanced
                    ? "bg-emerald-500"
                    : scenario.balance < 0.95
                      ? "bg-amber-500"
                      : "bg-brand-500"
                }`}
                initial={{ width: "0%" }}
                whileInView={{ width: `${Math.min(scenario.balance, 1.25) * 80}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
              />
            </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-500">
            <span>−25%</span>
            <span className="font-semibold text-ink-300">0%</span>
            <span>+25%</span>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium text-ink-200">
          {scenario.verdict}
        </p>

        {onAnalyze ? (
          <div className="mt-4 border-t border-hairline pt-3">
            {!aiAnalysis ? (
              <button
                type="button"
                onClick={onAnalyze}
                disabled={aiLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-500/40 bg-brand-600/90 px-3 py-2 text-sm font-semibold text-[#fff] shadow-sm transition hover:bg-brand-500 disabled:opacity-60"
              >
                <SparkIcon className={aiLoading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                <span>{aiLoading ? t("trade.ai.scenario.analyzing") : t("trade.ai.scenario.analyze")}</span>
                <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">Beta</span>
              </button>
            ) : null}

            {aiError ? (
              <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {aiError}
              </p>
            ) : null}

            {aiAnalysis ? (
              <div className="rounded-xl border border-brand-500/25 bg-surface-0 p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[#fff]">
                    <SparkIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-bold text-ink-50">
                    {t("trade.ai.scenario.analysisTitle")}
                  </span>
                  <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-300">Beta</span>
                  <button
                    type="button"
                    onClick={onAnalyze}
                    disabled={aiLoading}
                    className="ml-auto text-[11px] font-medium text-ink-400 transition hover:text-ink-100 disabled:opacity-50"
                  >
                    {aiLoading ? t("trade.ai.scenario.regenerating") : t("trade.ai.scenario.regenerate")}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto pr-1">
                  <AiAnalysisDisplay text={aiAnalysis} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
