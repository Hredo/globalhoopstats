"use client"

import { useT } from "@/lib/i18n/provider"

export function AppMockup() {
  const t = useT()

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[var(--shadow-court)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        <span className="ml-3 rounded-md bg-white/[0.06] px-3 py-1 font-mono text-[10px] text-ink-400">
          globalhoopstats.es / compare
        </span>
      </div>

      {/* Mockup body */}
      <div className="space-y-4 p-5 sm:p-6">
        {/* Section heading mock */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300">
            {t("home.mockup.compare")}
          </span>
        </div>

        {/* Two-column player comparison */}
        <div className="grid grid-cols-2 gap-3">
          {/* Player A */}
          <div className="rounded-xl border border-hairline bg-white/[0.03] p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/20 font-display text-sm font-bold text-brand-300">
                LB
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-50">Luka Dončić</p>
                <p className="font-mono text-[10px] text-ink-500">DAL · NBA</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { l: "PTS", a: 34 },
                { l: "REB", a: 12 },
                { l: "AST", a: 11 },
                { l: "PER", a: 88 },
              ].map((r) => (
                <div key={r.l} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                    {r.l}
                  </span>
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="h-full rounded-full bg-brand-500/70"
                      style={{ width: `${r.a}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[11px] font-semibold tabular-nums text-ink-100">
                    {r.a}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Player B */}
          <div className="rounded-xl border border-hairline bg-white/[0.03] p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-cyan/20 font-display text-sm font-bold text-accent-cyan">
                SG
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-50">Shai Gilgeous-A.</p>
                <p className="font-mono text-[10px] text-ink-500">OKC · NBA</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { l: "PTS", a: 31 },
                { l: "REB", a: 8 },
                { l: "AST", a: 9 },
                { l: "PER", a: 84 },
              ].map((r) => (
                <div key={r.l} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                    {r.l}
                  </span>
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="h-full rounded-full bg-accent-cyan/70"
                      style={{ width: `${r.a}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[11px] font-semibold tabular-nums text-ink-100">
                    {r.a}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer mock: verdict */}
        <div className="rounded-xl border-l-2 border-brand-500/50 bg-brand-500/[0.05] px-4 py-3">
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
