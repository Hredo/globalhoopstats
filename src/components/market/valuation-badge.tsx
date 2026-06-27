"use client"

import type { ValuationTier } from "@/lib/market/valuation"
import { leagueEconomics } from "@/lib/market/league-strength"
import { useT } from "@/lib/i18n/provider"

const TIER_COLORS: Record<
  ValuationTier,
  { color: string; bg: string }
> = {
  franchise: {
    color: "text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/25",
  },
  starter: {
    color: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/25",
  },
  rotation: {
    color: "text-sky-300",
    bg: "bg-sky-500/10 border-sky-500/25",
  },
  role: {
    color: "text-violet-300",
    bg: "bg-violet-500/10 border-violet-500/25",
  },
  fringe: {
    color: "text-ink-300",
    bg: "bg-white/5 border-white/10",
  },
}

const TIER_KEYS: Record<ValuationTier, string> = {
  franchise: "trade.marketValue.tierFranchise",
  starter: "trade.marketValue.tierStarter",
  rotation: "trade.marketValue.tierRotation",
  role: "trade.marketValue.tierRole",
  fringe: "trade.marketValue.tierFringe",
}

export function ValuationBadge({
  tier,
  size = "sm",
  leagueSlug,
}: {
  tier: ValuationTier
  size?: "sm" | "md"
  leagueSlug?: string
}) {
  const t = useT()
  const c = TIER_COLORS[tier]
  const s = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold uppercase tracking-[0.12em] ${s} ${c.color} ${c.bg}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: "currentColor" }}
      />
      {t(TIER_KEYS[tier])}
      {leagueSlug ? (
        <span className="opacity-60">
          {leagueEconomics(leagueSlug).label}
        </span>
      ) : null}
    </span>
  )
}
