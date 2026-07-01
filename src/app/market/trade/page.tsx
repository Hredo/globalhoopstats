"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Reveal } from "@/components/animations/reveal"
import Link from "next/link"
import { TradeScenarioCard } from "@/components/market/trade-scenario-card"
import { PlayerSearchPopover } from "@/components/market/player-search-popover"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"
import { exportTradePdf } from "@/components/market/export-pdf"
import { ValuationBadge } from "@/components/market/valuation-badge"
import { SmartImage } from "@/components/ui/smart-image"
import { Eyebrow } from "@/components/ui/eyebrow"
import { useT, useLocale } from "@/lib/i18n/provider"
import { CURRENCIES, formatCurrency, type CurrencyCode } from "@/lib/market/currency"
import type { Valuation } from "@/lib/market/valuation"

type PlayerHit = {
  id: string
  slug: string
  fullName: string
  position: string | null
  imageUrl: string | null
  team: { name: string; slug: string; logoUrl: string | null } | null
  league: { name: string; slug: string }
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

type Scenario = {
  combinedValueEur: number
  balance: number
  verdict: string
  incoming: {
    slug: string
    name: string
    position: string | null
    age: number | null
    league: { slug: string; name: string }
    team: { name: string; logoUrl: string | null } | null
    imageUrl: string | null
    valuation: Valuation
    stats: PerGameStats | null
  }[]
}

type TradeResult = {
  outgoing: {
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
  scenarios: Scenario[]
}

type RawStats = {
  pointsTotal: number | null
  reboundsTotal: number | null
  assistsTotal: number | null
  stealsTotal: number | null
  blocksTotal: number | null
  fgPct: number | null
  threePct: number | null
  ftPct: number | null
  per: number | null
  gamesPlayed: number | null
}

type ValuablePlayer = PlayerHit & {
  valuation?: Valuation | null
  stats?: RawStats | null
}

type Mode = "simular" | "proponer"

const POSITIONS = [
  { value: "G" },
  { value: "F" },
  { value: "C" },
] as const

// Directional slide+fade for the Simular ⇄ Proponer panels. `dir` is +1 when
// moving toward Proponer (enters from the right) and -1 toward Simular.
const modeVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 36 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36 }),
}

function perGame(s: RawStats | null | undefined): PerGameStats | null {
  if (!s) return null
  const gp = s.gamesPlayed || 1
  return {
    pointsPerGame: s.pointsTotal != null ? Math.round((s.pointsTotal / gp) * 10) / 10 : null,
    reboundsPerGame: s.reboundsTotal != null ? Math.round((s.reboundsTotal / gp) * 10) / 10 : null,
    assistsPerGame: s.assistsTotal != null ? Math.round((s.assistsTotal / gp) * 10) / 10 : null,
    stealsPerGame: s.stealsTotal != null ? Math.round((s.stealsTotal / gp) * 10) / 10 : null,
    blocksPerGame: s.blocksTotal != null ? Math.round((s.blocksTotal / gp) * 10) / 10 : null,
    fgPct: s.fgPct != null ? Math.round(s.fgPct * 1000) / 10 : null,
    threePct: s.threePct != null ? Math.round(s.threePct * 1000) / 10 : null,
    ftPct: s.ftPct != null ? Math.round(s.ftPct * 1000) / 10 : null,
    per: s.per != null ? Math.round(s.per * 10) / 10 : null,
    gamesPlayed: s.gamesPlayed,
  }
}

function StatsRow({ stats }: { stats: PerGameStats | null | undefined }) {
  const t = useT()
  if (!stats) return null
  const items = [
    { label: t("trade.stats.gp"), value: stats.gamesPlayed },
    { label: t("trade.stats.pts"), value: stats.pointsPerGame },
    { label: t("trade.stats.reb"), value: stats.reboundsPerGame },
    { label: t("trade.stats.ast"), value: stats.assistsPerGame },
    { label: t("trade.stats.stl"), value: stats.stealsPerGame },
    { label: t("trade.stats.blk"), value: stats.blocksPerGame },
    { label: t("trade.stats.per"), value: stats.per },
  ].filter((x) => x.value != null)
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] text-ink-400">
      {items.map((x) => (
        <span key={x.label} className="whitespace-nowrap">
          {x.label}: <strong className="text-ink-300">{typeof x.value === "number" ? x.value.toFixed(1) : "—"}</strong>
        </span>
      ))}
    </div>
  )
}

function parseCashInput(value: string): number | null {
  if (!value) return 0
  const cleaned = value.replace(/[€$£,.\s]/g, "").trim()
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([mMkK]?)$/)
  if (!match) return null
  const num = parseFloat(match[1])
  const suffix = match[2].toUpperCase()
  if (suffix === "M") return num * 1_000_000
  if (suffix === "K") return num * 1_000
  return num
}

export default function TradePage() {
  const t = useT()
  const locale = useLocale()
  const [mode, setMode] = useState<Mode>("simular")
  const [currency, setCurrency] = useState<CurrencyCode>("EUR")

  // Load user's preferred currency
  useEffect(() => {
    fetch("/api/account/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings?.currency) setCurrency(data.settings.currency as CurrencyCode)
      })
      .catch(() => {})
  }, [])

  // ── Simular mode ──
  const [selected, setSelected] = useState<PlayerHit | null>(null)
  const [needPos, setNeedPos] = useState<string>("")
  const [result, setResult] = useState<TradeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // ── AI analysis ──
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState("")
  // Per-scenario AI analysis (Simular mode): keyed by scenario index.
  const [scenarioAi, setScenarioAi] = useState<
    Record<number, { loading: boolean; analysis: string | null; error: string | null }>
  >({})

  const switchMode = (m: Mode) => {
    setMode(m)
    setAiAnalysis(null)
    setAiError("")
  }

  const runTrade = async () => {
    if (!selected) return
    setLoading(true)
    setError("")
    setAiAnalysis(null)
    setAiError("")
    setScenarioAi({})
    try {
      const res = await fetch("/api/market/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myPlayerSlug: selected.slug,
          needPositions: needPos ? [needPos] : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? t("trade.errors.simulating"))
        setResult(null)
        return
      }
      const data = await res.json()
      setResult(data)
    } catch {
      setError(t("trade.errors.networkError"))
    } finally {
      setLoading(false)
    }
  }

  // ── Proponer mode ──
  const [outgoing, setOutgoing] = useState<ValuablePlayer[]>([])
  const [incoming, setIncoming] = useState<ValuablePlayer[]>([])
  const [cashOutText, setCashOutText] = useState("")
  const [cashInText, setCashInText] = useState("")

  const cashOut = parseCashInput(cashOutText) ?? 0
  const cashIn = parseCashInput(cashInText) ?? 0

  const removeOutgoing = (slug: string) => setOutgoing((p) => p.filter((x) => x.slug !== slug))
  const removeIncoming = (slug: string) => setIncoming((p) => p.filter((x) => x.slug !== slug))

  const addOutgoing = (p: PlayerHit) => {
    if (outgoing.some((x) => x.slug === p.slug)) return
    fetchValuation(p).then((vp) => setOutgoing((prev) => [...prev, vp]))
  }

  const addIncoming = (p: PlayerHit) => {
    if (incoming.some((x) => x.slug === p.slug)) return
    fetchValuation(p).then((vp) => setIncoming((prev) => [...prev, vp]))
  }

  const fetchValuation = async (p: PlayerHit): Promise<ValuablePlayer> => {
    try {
      const res = await fetch(`/api/players/${p.slug}/valuation`)
      if (res.ok) {
        const data = await res.json()
        return { ...p, valuation: data.valuation, stats: data.stats }
      }
    } catch {
      // ignore
    }
    return p
  }

  const outValEur = outgoing.reduce((s, p) => s + (p.valuation?.eur ?? 0), 0) + cashOut
  const inValEur = incoming.reduce((s, p) => s + (p.valuation?.eur ?? 0), 0) + cashIn
  const balance = outValEur > 0 ? inValEur / outValEur : 0
  const balanced = balance >= 0.95 && balance <= 1.08
  const balanceColor = balanced ? "text-emerald-400" : balance < 0.95 ? "text-amber-400" : "text-brand-400"

  const proponerTitle = (() => {
    if (outgoing.length === 0 && incoming.length === 0) return t("trade.proposeTitle.addPlayers")
    const outName = outgoing[0]?.fullName ?? ""
    const inName = incoming[0]?.fullName ?? ""
    const suffix = outValEur > 0 && inValEur > 0 ? ` — ${formatCurrency(outValEur, currency)} → ${formatCurrency(inValEur, currency)}` : ""
    if (outgoing.length === 1 && incoming.length === 1) return `${outName} ↔ ${inName}${suffix}`
     return `${t("trade.proposeTitle.proposal", { out: outgoing.length, in: incoming.length })}${suffix}`
  })()

  // ── PDF export ──
  const exportPdf = () => {
    if (mode === "simular" && result) {
      const analyses: Record<number, string> = {}
      Object.entries(scenarioAi).forEach(([k, v]) => {
        if (v.analysis) analyses[Number(k)] = v.analysis
      })
      exportTradePdf({
        mode: "Simular",
        outgoing: {
          name: result.outgoing.name,
          position: result.outgoing.position,
          team: result.outgoing.team?.name ?? null,
          league: result.outgoing.league.name,
          valuation: result.outgoing.valuation,
        },
        scenarios: result.scenarios.map((s) => ({
          verdict: s.verdict,
          balance: s.balance,
          combinedValueEur: s.combinedValueEur,
          incoming: s.incoming.map((p) => ({
            name: p.name,
            position: p.position,
            team: p.team?.name ?? null,
            league: p.league.name,
            valuation: p.valuation,
          })),
        })),
        analyses,
      }, locale)
    } else if (mode === "proponer" && (outgoing.length > 0 || incoming.length > 0)) {
      exportTradePdf({
        mode: "Proponer",
        outgoing: outgoing.map((p) => ({
          name: p.fullName,
          position: p.position,
          team: p.team?.name ?? null,
          league: p.league.name,
          valuation: p.valuation ?? null,
        })),
        incoming: incoming.map((p) => ({
          name: p.fullName,
          position: p.position,
          team: p.team?.name ?? null,
          league: p.league.name,
          valuation: p.valuation ?? null,
        })),
        cash: cashOut,
        terms: "",
        balance,
        analysis: aiAnalysis,
      }, locale)
    }
  }

  // ── AI analysis ──
  const runAiAnalysis = async () => {
    setAiLoading(true)
    setAiAnalysis(null)
    setAiError("")

    const buildPlayerInfo = (p: ValuablePlayer) => ({
      name: p.fullName,
      position: p.position,
      team: p.team?.name ?? null,
      league: p.league.name,
      valuation: p.valuation ?? null,
      stats: perGame(p.stats),
    })

    try {
      let body: Record<string, unknown>

      if (mode === "simular" && result) {
        body = {
          mode: "simular",
          outgoing: [{
            name: result.outgoing.name,
            position: result.outgoing.position,
            team: result.outgoing.team?.name ?? null,
            league: result.outgoing.league.name,
            valuation: result.outgoing.valuation,
            stats: result.outgoing.stats,
          }],
          incoming: [],
          cash: cashOut,
          terms: "",
          scenarios: result.scenarios.map((s) => ({
            combinedValueEur: s.combinedValueEur,
            balance: s.balance,
            verdict: s.verdict,
            incoming: s.incoming,
          })),
          currency,
        }
      } else {
        body = {
          mode: "proponer",
          outgoing: outgoing.map(buildPlayerInfo),
          incoming: incoming.map(buildPlayerInfo),
          cash: cashOut,
          terms: "",
          currency,
        }
      }

      const res = await fetch("/api/market/trade/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error ?? t("trade.ai.errorGenerating"))
        return
      }
      setAiAnalysis(data.analysis)
    } catch {
      setAiError(t("trade.ai.networkError"))
    } finally {
      setAiLoading(false)
    }
  }

  // Per-scenario AI analysis: treats the outgoing player vs. that single
  // package as a focused "proponer" proposal so the model reasons about value,
  // stats, position fit and what you gain vs lose in THAT specific trade.
  const runScenarioAi = async (index: number) => {
    if (!result) return
    const scenario = result.scenarios[index]
    if (!scenario) return
    setScenarioAi((prev) => ({
      ...prev,
      [index]: { loading: true, analysis: prev[index]?.analysis ?? null, error: null },
    }))
    try {
      const body = {
        mode: "proponer" as const,
        outgoing: [
          {
            name: result.outgoing.name,
            position: result.outgoing.position,
            team: result.outgoing.team?.name ?? null,
            league: result.outgoing.league.name,
            valuation: result.outgoing.valuation,
            stats: result.outgoing.stats,
          },
        ],
        incoming: scenario.incoming.map((p) => ({
          name: p.name,
          position: p.position,
          team: p.team?.name ?? null,
          league: p.league.name,
          valuation: p.valuation,
          stats: p.stats,
        })),
        cash: 0,
        terms: "",
        currency,
      }
      const res = await fetch("/api/market/trade/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setScenarioAi((prev) => ({
          ...prev,
          [index]: { loading: false, analysis: null, error: data.error ?? t("trade.ai.errorGenerating") },
        }))
        return
      }
      setScenarioAi((prev) => ({
        ...prev,
        [index]: { loading: false, analysis: data.analysis, error: null },
      }))
    } catch {
      setScenarioAi((prev) => ({
        ...prev,
          [index]: { loading: false, analysis: null, error: t("trade.ai.networkError") },
      }))
    }
  }

  const aiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aiAnalysis && aiRef.current) {
      aiRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [aiAnalysis])

  const initials = (s: string) =>
    s.split(" ").map((w) => w[0]).slice(0, 2).join("")

  // Slide direction: Proponer sits to the right of Simular.
  const direction = mode === "proponer" ? 1 : -1

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Reveal>
      <div className="mb-8">
        <Eyebrow>{t("trade.page.eyebrow")}</Eyebrow>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="gh-title-rule">
            <h1 className="font-display text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.012em] text-balance text-ink-50 sm:text-5xl md:text-6xl">
              {t("trade.page.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-ink-300 sm:text-base">
              {t("trade.page.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-hairline bg-surface-0 p-0.5">
              {(["EUR", "USD", "GBP"] as CurrencyCode[]).map((code) => (
                <button
                  key={code}
                  onClick={() => {
                    setCurrency(code)
                    fetch("/api/account/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ currency: code }),
                    }).catch(() => {})
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    currency === code
                      ? "bg-brand-600 text-[#fff]"
                      : "text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <Link
              href="/market/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300 transition hover:border-brand-500/40 hover:text-brand-300"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              {t("trade.page.docs")}
            </Link>
          </div>
        </div>
      </div>
      </Reveal>

      {/* Mode tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-hairline bg-surface-1 p-1">
        {(["simular", "proponer"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`relative flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
              mode === m ? "text-[#fff]" : "text-ink-300 hover:text-ink-100"
            }`}
          >
            {mode === m ? (
              <motion.span
                layoutId="tradeModePill"
                className="absolute inset-0 rounded-lg bg-brand-600 shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">
              {m === "simular" ? t("trade.mode.simulate") : t("trade.mode.propose")}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={mode}
          custom={direction}
          variants={modeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
      {/* Simular mode */}
      {mode === "simular" ? (
        <>
          <div className="rounded-2xl border border-hairline bg-surface-1 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="min-w-0">
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  {t("trade.form.playerToTrade")}
                </label>
                <PlayerSearchPopover
                  selected={selected}
                  onSelect={(p) => {
                    setSelected(p)
                    setResult(null)
                    setError("")
                    setAiAnalysis(null)
                    setAiError("")
                    setScenarioAi({})
                  }}
                  onClear={() => {
                    setSelected(null)
                    setResult(null)
                    setAiAnalysis(null)
                    setScenarioAi({})
                  }}
                  placeholder={t("trade.form.searchPlayer")}
                  side="neutral"
                />
              </div>

              <div className="sm:w-52">
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  {t("trade.form.positionNeeded")}
                </label>
                <select
                  value={needPos}
                  onChange={(e) => setNeedPos(e.target.value)}
                  className="gh-input w-full"
                >
                  <option value="">{t("trade.form.anyPosition")}</option>
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.value === "G" ? t("trade.form.positions.guard") : p.value === "F" ? t("trade.form.positions.forward") : t("trade.form.positions.center")}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={runTrade}
                disabled={!selected || loading}
                className="gh-btn-primary h-[44px] whitespace-nowrap"
              >
                {loading ? t("trade.actions.analyzing") : t("trade.actions.simulateTrade")}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-8">
              <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-court-800">
                    <SmartImage
                      src={result.outgoing.imageUrl}
                      alt={result.outgoing.name}
                      fit="cover"
                      fallbackClassName="text-xs font-bold text-ink-400"
                      fallback={initials(result.outgoing.name)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-xl font-bold text-ink-50">{result.outgoing.name}</p>
                      <ValuationBadge tier={result.outgoing.valuation.tier} size="sm" leagueSlug={result.outgoing.league.slug} />
                    </div>
                    <p className="font-mono text-[11px] text-ink-400">
                      {result.outgoing.position ?? "—"} · {result.outgoing.league.name} · {result.outgoing.team?.name ?? "FA"}
                    </p>
                    {result.outgoing.stats ? <StatsRow stats={result.outgoing.stats} /> : null}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-display text-2xl font-bold text-ink-50">
                    {formatCurrency(result.outgoing.valuation.eur, currency)}
                  </p>
                  <p className="font-mono text-[10px] text-ink-400">
                    {t("trade.results.value", { currency: CURRENCIES[currency].symbol })}
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-300">
                    {t("trade.results.scenariosFound", { count: result.scenarios.length })}
                  </p>
                  {result.scenarios.length > 0 ? (
                    <p className="mt-0.5 text-xs text-ink-500">
                      {t("trade.results.analyzeWithAiHintPre")} <span className="font-medium text-brand-300">{t("trade.results.analyzeWithAiHintBtn")}</span> <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-300">Beta</span> {t("trade.results.analyzeWithAiHintPost")}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={exportPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-0 px-3.5 py-2 text-sm font-semibold text-ink-200 transition hover:bg-surface-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M12 18v-6" />
                    <path d="M9 15l3 3 3-3" />
                  </svg>
                  {t("trade.actions.downloadPdf")}
                </button>
              </div>

              {result.scenarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-surface-0 p-8 text-center text-sm text-ink-400">
                  {t("trade.results.noScenarios")}
                </div>
              ) : (
                <motion.div
                  className="grid gap-4 sm:grid-cols-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.08 } },
                  }}
                >
                  {result.scenarios.map((s, i) => (
                    <motion.div
                      key={i}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.5, ease: [0.19, 1, 0.22, 1] },
                        },
                      }}
                    >
                      <TradeScenarioCard
                        scenario={s}
                        outgoingName={result.outgoing.name}
                        outgoingValue={result.outgoing.valuation.eur}
                        currency={currency}
                        onAnalyze={() => runScenarioAi(i)}
                        aiLoading={scenarioAi[i]?.loading ?? false}
                        aiAnalysis={scenarioAi[i]?.analysis ?? null}
                        aiError={scenarioAi[i]?.error ?? null}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {/* Proponer mode */}
      {mode === "proponer" ? (
        <>
          {(outgoing.length > 0 || incoming.length > 0) ? (
            <div className="mb-6 rounded-xl border border-hairline bg-surface-1 p-4 text-center">
              <p className="gh-eyebrow mb-1">{proponerTitle}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm">
                <span className="text-ink-300">
                  {CURRENCIES[currency].symbol} {t("trade.propose.youGive")}:{" "}
                  <strong className="text-ink-100">{formatCurrency(outValEur, currency)}</strong>
                </span>
                <span className="font-display text-xl text-ink-500">→</span>
                <span className="text-ink-300">
                  {CURRENCIES[currency].symbol} {t("trade.propose.youReceive")}:{" "}
                  <strong className="text-ink-100">{formatCurrency(inValEur, currency)}</strong>
                </span>
                <span className="h-6 w-px bg-hairline" />
                <span className={`font-semibold ${balanceColor}`}>
                  {t("trade.propose.balance")}: {balance.toFixed(2)}
                </span>
                <span className="text-xs text-ink-400">
                  {balanced ? t("trade.propose.balanced") : balance < 0.95 ? t("trade.propose.giveMoreValue") : t("trade.propose.receiveMoreValue")}
                </span>
              </div>
              <div className="mx-auto mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${balanced ? "bg-emerald-500" : "bg-amber-500"}`}
                  initial={{ width: "0%" }}
                  animate={{ width: `${Math.min(balance, 1.5) * 66}%` }}
                  transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
                />
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-dashed border-white/20 bg-surface-0 p-6 text-center text-sm text-ink-400">
              {t("trade.propose.addPlayersHint")}
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Left: Outgoing */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-amber-500/20 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/25 font-mono text-[11px] font-bold text-amber-300">T</span>
                <h3 className="font-semibold text-ink-50">{t("trade.propose.sectionGive")}</h3>
                <span className="ml-auto font-mono text-[10px] text-ink-400">
                  {outgoing.length} {outgoing.length === 1 ? t("trade.propose.playerSingular") : t("trade.propose.playerPlural")}
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                {outgoing.map((p) => (
                  <motion.div
                    key={p.slug}
                    layout
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
                    className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-surface-0 p-3"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-court-800">
                      <SmartImage src={p.imageUrl} alt={p.fullName} fit="cover"
                        fallbackClassName="text-[9px] font-bold text-ink-400"
                        fallback={initials(p.fullName)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-ink-100">{p.fullName}</p>
                        {p.valuation ? <ValuationBadge tier={p.valuation.tier} size="sm" leagueSlug={p.league.slug} /> : null}
                      </div>
                      <p className="font-mono text-[10px] text-ink-400">
                        {p.position ?? "—"} · {p.team?.name ?? "FA"} · {p.league.name}
                      </p>
                      {p.stats ? <StatsRow stats={perGame(p.stats)} /> : null}
                      {p.valuation ? (
                        <div className="mt-1 flex items-center gap-3">
                          <span className="font-display text-sm font-bold text-ink-50">
                            {formatCurrency(p.valuation.eur, currency)}
                          </span>
                          <span className="font-mono text-[10px] text-ink-400">{t("trade.propose.valueLabel")}</span>
                          <span className="font-mono text-[10px] text-ink-400">{t("trade.propose.ratingLabel")}: {p.valuation.rating}/100</span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => removeOutgoing(p.slug)}
                      className="shrink-0 rounded p-1 text-ink-500 transition hover:bg-red-500/15 hover:text-red-400"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="mt-2">
                <PlayerSearchPopover
                  selected={null}
                  onSelect={addOutgoing}
                  placeholder={t("trade.propose.addPlayer")}
                  side="left"
                  excludeSlugs={[...outgoing.map((p) => p.slug), ...incoming.map((p) => p.slug)]}
                />
              </div>

              <div className="mt-3">
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-amber-400/70">
                  {t("trade.propose.cashGiveLabel", { currency: CURRENCIES[currency].symbol })}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                    {CURRENCIES[currency].symbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashOutText}
                    onChange={(e) => setCashOutText(e.target.value)}
                    placeholder="0"
                    className="gh-input w-full pl-7"
                  />
                </div>
                {cashOut > 0 ? (
                  <p className="mt-1 font-mono text-[9px] text-ink-500">
                    +{formatCurrency(cashOut, currency)} {t("trade.propose.cashSuffix")}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Right: Incoming */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-emerald-500/20 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 font-mono text-[11px] font-bold text-emerald-300">R</span>
                <h3 className="font-semibold text-ink-50">{t("trade.propose.sectionReceive")}</h3>
                <span className="ml-auto font-mono text-[10px] text-ink-400">
                  {incoming.length} {incoming.length === 1 ? t("trade.propose.playerSingular") : t("trade.propose.playerPlural")}
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                {incoming.map((p) => (
                  <motion.div
                    key={p.slug}
                    layout
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
                    className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-surface-0 p-3"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-court-800">
                      <SmartImage src={p.imageUrl} alt={p.fullName} fit="cover"
                        fallbackClassName="text-[9px] font-bold text-ink-400"
                        fallback={initials(p.fullName)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-ink-100">{p.fullName}</p>
                        {p.valuation ? <ValuationBadge tier={p.valuation.tier} size="sm" leagueSlug={p.league.slug} /> : null}
                      </div>
                      <p className="font-mono text-[10px] text-ink-400">
                        {p.position ?? "—"} · {p.team?.name ?? "FA"} · {p.league.name}
                      </p>
                      {p.stats ? <StatsRow stats={perGame(p.stats)} /> : null}
                      {p.valuation ? (
                        <div className="mt-1 flex items-center gap-3">
                          <span className="font-display text-sm font-bold text-ink-50">
                            {formatCurrency(p.valuation.eur, currency)}
                          </span>
                          <span className="font-mono text-[10px] text-ink-400">{t("trade.propose.valueLabel")}</span>
                          <span className="font-mono text-[10px] text-ink-400">{t("trade.propose.ratingLabel")}: {p.valuation.rating}/100</span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => removeIncoming(p.slug)}
                      className="shrink-0 rounded p-1 text-ink-500 transition hover:bg-red-500/15 hover:text-red-400"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="mt-2">
                <PlayerSearchPopover
                  selected={null}
                  onSelect={addIncoming}
                  placeholder={t("trade.propose.addPlayer")}
                  side="right"
                  excludeSlugs={[...outgoing.map((p) => p.slug), ...incoming.map((p) => p.slug)]}
                />
              </div>

              <div className="mt-3">
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400/70">
                  {t("trade.propose.cashReceiveLabel", { currency: CURRENCIES[currency].symbol })}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                    {CURRENCIES[currency].symbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashInText}
                    onChange={(e) => setCashInText(e.target.value)}
                    placeholder="0"
                    className="gh-input w-full pl-7"
                  />
                </div>
                {cashIn > 0 ? (
                  <p className="mt-1 font-mono text-[9px] text-ink-500">
                    +{formatCurrency(cashIn, currency)} {t("trade.propose.cashSuffix")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          {(outgoing.length > 0 || incoming.length > 0) ? (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-500/40 bg-brand-600 px-5 py-2.5 text-sm font-bold text-[#fff] shadow-lg shadow-brand-900/30 transition hover:bg-brand-500 hover:shadow-brand-700/40 disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                {aiLoading ? t("trade.ai.loading") : t("trade.ai.title")}
                <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">Beta</span>
              </button>
              <button
                onClick={exportPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-4 py-2.5 text-sm font-semibold text-ink-200 transition hover:bg-surface-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M12 18v-6" />
                  <path d="M9 15l3 3 3-3" />
                </svg>
                  {t("trade.actions.downloadPdf")}
              </button>
            </div>
          ) : null}

          {aiAnalysis ? (
            <div ref={aiRef} className="mt-6 rounded-xl border-2 border-brand-500/30 bg-surface-1 p-5 shadow-lg">
              <div className="mb-3 flex items-center gap-2 border-b border-hairline pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-ink-50">{t("trade.ai.analysisTitle")}</span>
                <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-300">Beta</span>
              </div>
              <AiAnalysisDisplay text={aiAnalysis} />
            </div>
          ) : null}

          {aiError ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              {aiError}
            </div>
          ) : null}
        </>
      ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
