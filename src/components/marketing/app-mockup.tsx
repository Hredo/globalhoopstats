"use client"

import { useT } from "@/lib/i18n/provider"

const METRICS = [
  { l: "PTS", a: 34, b: 31 },
  { l: "REB", a: 12, b: 8 },
  { l: "AST", a: 11, b: 9 },
  { l: "PER", a: 88, b: 84 },
] as const

export function AppMockup() {
  const t = useT()

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[var(--shadow-court)]">
      {/* Index header — editorial ledger cue instead of browser chrome */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div className="relative pl-3">
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-300 to-brand-600" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            {t("home.mockup.compare")}
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums tracking-[0.14em] text-ink-500">
          Nº 01 — 24 MÉTRICAS
        </span>
      </div>

      {/* Ledger body */}
      <div className="space-y-4 p-5 sm:p-6">
        {/* Entry row — the two indexed players */}
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
          <div className="flex items-center gap-2">
            <span className="text-brand-400">01</span>
            <span className="text-ink-100">Dončić</span>
            <span className="text-ink-500">DAL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-500">OKC</span>
            <span className="text-ink-100">Gilgeous-A.</span>
            <span className="text-accent-cyan">02</span>
          </div>
        </div>

        {/* Diverging comparison rails — the signature gesture */}
        <div className="space-y-3 border-y border-hairline py-4">
          {METRICS.map((m) => {
            const scale = Math.max(m.a, m.b)
            const aw = (m.a / scale) * 50
            const bw = (m.b / scale) * 50
            return (
              <div key={m.l} className="space-y-1">
                <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2">
                  <span className="text-right font-mono text-sm font-bold tabular-nums text-brand-300">
                    {m.a}
                  </span>
                  <div className="relative h-2 rounded-full bg-white/[0.05]">
                    <span
                      className="absolute right-1/2 top-0 h-full rounded-l-full bg-brand-500/75"
                      style={{ width: `${aw}%` }}
                    />
                    <span
                      className="absolute left-1/2 top-0 h-full rounded-r-full bg-accent-cyan/70"
                      style={{ width: `${bw}%` }}
                    />
                    <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-hairline-strong" />
                  </div>
                  <span className="text-left font-mono text-sm font-bold tabular-nums text-accent-cyan">
                    {m.b}
                  </span>
                </div>
                <p className="text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
                  {m.l}
                </p>
              </div>
            )
          })}
        </div>

        {/* Market quote row — stats meet market */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              Valor
            </p>
            <p className="font-display text-base font-bold tabular-nums text-ink-50">
              €32.4M{" "}
              <span className="font-mono text-[11px] font-semibold text-positive">
                ▲ 4%
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
              Valor
            </p>
            <p className="font-display text-base font-bold tabular-nums text-ink-50">
              €28.1M{" "}
              <span className="font-mono text-[11px] font-semibold text-negative">
                ▼ 2%
              </span>
            </p>
          </div>
        </div>

        {/* Verdict — annotation with the orange spine */}
        <div className="relative rounded-r-lg bg-brand-500/[0.05] py-2 pl-4 pr-3">
          <span className="absolute left-0 top-0 h-full w-[3px] rounded-full bg-gradient-to-b from-brand-300 to-brand-600" />
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-brand-300">
            {t("home.mockup.verdict")}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-200">
            {t("home.mockup.verdictText")}
          </p>
        </div>
      </div>
    </div>
  )
}
