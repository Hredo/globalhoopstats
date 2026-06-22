/**
 * Trade balancing — the "one star for a package" logic. Given a player you'd
 * move (estimated value V), it searches other teams for single players or
 * 2-/3-man packages whose combined value lands near V, so the global value of
 * the deal balances. Optionally constrained to positions you actually need.
 */
import { adjacentLeagueSlugs } from "@/lib/market/league-strength"
import { getMarketPlayerBySlug, getMarketPool, type MarketPlayer } from "@/lib/market/pool"
import type { Locale } from "@/lib/i18n/config"

/** Locale-independent verdict, resolved to a label at the API boundary. */
export type TradeVerdictKey = "balanced" | "short" | "over"

export type TradeScenario = {
  incoming: MarketPlayer[]
  combinedValueEur: number
  /** incoming / outgoing, as a ratio (1.0 = perfectly balanced). */
  balance: number
  verdictKey: TradeVerdictKey
}

export type TradeQuery = {
  myPlayerSlug: string
  /** Limit incoming pieces to these position buckets ("G" | "F" | "C"). */
  needPositions?: Array<"G" | "F" | "C">
  /** Restrict partner pool to these leagues. Default: adjacent to my league. */
  leagueSlugs?: string[]
  maxScenarios?: number
}

function bucket(position: string | null): "G" | "F" | "C" | "?" {
  const p = (position ?? "").toUpperCase()
  if (p.startsWith("PG") || p.startsWith("SG") || p.startsWith("1") || p.startsWith("2") || p === "G")
    return "G"
  if (p.startsWith("SF") || p.startsWith("PF") || p.startsWith("3") || p.startsWith("4") || p === "F")
    return "F"
  if (p.startsWith("C") || p.startsWith("5")) return "C"
  return "?"
}

function verdictKeyFor(balance: number): TradeVerdictKey {
  if (balance >= 0.95 && balance <= 1.08) return "balanced"
  if (balance < 0.95) return "short"
  return "over"
}

const TRADE_VERDICT_LABELS: Record<Locale, Record<TradeVerdictKey, string>> = {
  es: {
    balanced: "Intercambio equilibrado",
    short: "Te quedas corto de valor — pide algo más",
    over: "Recibes más valor del que entregas",
  },
  en: {
    balanced: "Balanced trade",
    short: "You're short on value — ask for more",
    over: "You receive more value than you give",
  },
}

/** Resolve a verdict key to a localized label. Used at the API boundary. */
export function tradeVerdictLabel(key: TradeVerdictKey, locale: Locale): string {
  return TRADE_VERDICT_LABELS[locale][key]
}

export async function buildTradeScenarios(
  q: TradeQuery,
): Promise<{ outgoing: MarketPlayer; scenarios: TradeScenario[] } | null> {
  const mine = await getMarketPlayerBySlug(q.myPlayerSlug)
  if (!mine) return null
  const V = mine.valuation.eur
  if (V <= 0) return { outgoing: mine, scenarios: [] }

  const leagues =
    q.leagueSlugs ?? adjacentLeagueSlugs(mine.league.slug, { includeSelf: true })
  const pool = await getMarketPool(leagues)

  // Plausible trade pieces: from other teams, not absurdly more valuable than
  // my player, and a meaningful asset (≥15% of V). Capped & sorted for cheap
  // combinatorics.
  const pieces = pool
    .filter((p) => p.id !== mine.id && p.team?.id && p.team.id !== mine.team?.id)
    .filter((p) => p.valuation.eur >= V * 0.15 && p.valuation.eur <= V * 1.1)
    .filter(
      (p) => !q.needPositions?.length || q.needPositions.includes(bucket(p.position) as "G" | "F" | "C"),
    )
    .sort((a, b) => b.valuation.eur - a.valuation.eur)
    .slice(0, 60)

  const scenarios: TradeScenario[] = []
  const push = (incoming: MarketPlayer[]) => {
    const combined = incoming.reduce((s, p) => s + p.valuation.eur, 0)
    const balance = combined / V
    if (balance < 0.8 || balance > 1.25) return
    scenarios.push({
      incoming,
      combinedValueEur: combined,
      balance: Math.round(balance * 100) / 100,
      verdictKey: verdictKeyFor(balance),
    })
  }

  // 1-for-1
  for (const p of pieces) push([p])
  // 2-for-1
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) push([pieces[i], pieces[j]])
  }
  // 3-for-1 (only the lower-value tail to keep packages realistic)
  const tail = pieces.filter((p) => p.valuation.eur <= V * 0.55)
  for (let i = 0; i < tail.length; i++)
    for (let j = i + 1; j < tail.length; j++)
      for (let k = j + 1; k < tail.length; k++) push([tail[i], tail[j], tail[k]])

  // Rank by how close to balanced, prefer fewer pieces on ties.
  scenarios.sort((a, b) => {
    const da = Math.abs(a.balance - 1)
    const db = Math.abs(b.balance - 1)
    if (Math.abs(da - db) > 0.02) return da - db
    return a.incoming.length - b.incoming.length
  })

  // De-duplicate near-identical single-player scenarios dominating the list:
  // keep variety by limiting to maxScenarios.
  return { outgoing: mine, scenarios: scenarios.slice(0, q.maxScenarios ?? 8) }
}
