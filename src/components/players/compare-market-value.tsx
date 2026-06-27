"use client"

import { motion, type Variants } from "framer-motion"
import { formatEur } from "@/lib/market/league-strength"
import type { Valuation } from "@/lib/market/valuation"
import { ValuationBadge } from "@/components/market/valuation-badge"
import { AnimatedBar } from "@/components/animations/animated-bar"
import { useT } from "@/lib/i18n/provider"

type Props = {
  aName: string
  bName: string
  a: Valuation
  b: Valuation
}

/**
 * Side-by-side estimated market value for the two compared players. Mirrors the
 * compare colour language (player A = brand, player B = accent-cyan) and reuses
 * the same valuation labels as the trade simulator.
 */
const columnVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.19, 1, 0.22, 1] as const },
  }),
}

export function CompareMarketValue({ aName, bName, a, b }: Props) {
  const t = useT()
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className="gh-card p-4 sm:p-5"
    >
      <h2 className="gh-eyebrow">{t("trade.marketValue.title")}</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <motion.div
          custom={0}
          variants={columnVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <ValueColumn name={aName} v={a} accent="brand" leads={a.eur > b.eur} />
        </motion.div>
        <motion.div
          custom={1}
          variants={columnVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <ValueColumn name={bName} v={b} accent="cyan" leads={b.eur > a.eur} />
        </motion.div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        {t("compare.marketValueNote")}
      </p>
    </motion.div>
  )
}

function ValueColumn({
  name,
  v,
  accent,
  leads,
}: {
  name: string
  v: Valuation
  accent: "brand" | "cyan"
  leads: boolean
}) {
  const t = useT()
  const nameColor = accent === "brand" ? "text-brand-300" : "text-accent-cyan"
  const barColor = accent === "brand" ? "bg-brand-500" : "bg-accent-cyan"
  const ring = leads
    ? accent === "brand"
      ? "ring-1 ring-brand-500/40"
      : "ring-1 ring-accent-cyan/40"
    : ""
  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate font-mono text-[11px] uppercase tracking-[0.14em] ${nameColor}`}>
          {name}
        </p>
        {leads ? (
          <span className={`text-xs ${nameColor}`} aria-hidden>
            ▲
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-50">
        {formatEur(v.eur)}
      </p>
      <p className="mt-0.5 text-xs text-ink-300">{t("trade.marketValue.estimatedValue")}</p>

      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm">
        <span className="text-ink-300">{t("trade.marketValue.annualSalary")}</span>
        <span className="font-semibold text-ink-100">{formatEur(v.annualEur)}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <ValuationBadge tier={v.tier} leagueSlug={v.leagueSlug} />
        <span className="font-mono text-xs font-bold text-ink-100">{v.rating}/100</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <AnimatedBar
          value={v.rating}
          max={100}
          delay={0.15}
          duration={0.6}
          color={barColor}
        />
      </div>
    </div>
  )
}
