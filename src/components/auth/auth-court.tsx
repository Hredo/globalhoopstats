"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useT, useLocale } from "@/lib/i18n/provider"

// The 1v1 scene is decorative and desktop-only, so its chunk is split out and
// fetched lazily — it only ever downloads on /login and /register, and only on
// lg+ viewports (the panel is hidden below lg).
const AuthDuel = dynamic(() => import("@/components/auth/auth-duel"), {
  ssr: false,
  loading: () => null,
})

export type AuthCourtStats = {
  leagues: number
  players: number
  teams: number
  coaches: number
}

type Props = {
  className?: string
  stats: AuthCourtStats
}

const LEAGUES = ["NBA", "EuroLeague", "ACB", "Primera FEB", "Segunda FEB", "Tercera FEB"]

export function AuthCourt({ className, stats }: Props) {
  const t = useT()
  const locale = useLocale()
  const numberLocale = locale === "es" ? "es-ES" : "en-US"
  const [sceneOn, setSceneOn] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const update = () => setSceneOn(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const cards = [
    { labelKey: "auth.courtLeaguesLive", value: String(stats.leagues) },
    {
      labelKey: "auth.courtPlayersIndexed",
      value: stats.players.toLocaleString(numberLocale),
    },
    {
      labelKey: "auth.courtTeamsTracked",
      value: stats.teams.toLocaleString(numberLocale),
    },
    {
      labelKey: "auth.courtCoaches",
      value: stats.coaches.toLocaleString(numberLocale),
    },
  ]

  return (
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-court-900 via-surface-2 to-court-950">
        {/* Court floor pattern overlay */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 4px)",
          }}
        />

        {sceneOn ? (
          <AuthDuel className="absolute inset-0 h-full w-full" />
        ) : null}

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-8 sm:p-12">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-brand-300/80">
              globalhoopstats
            </p>
            <h2 className="mt-3 max-w-md font-display text-2xl font-bold text-ink-50 sm:text-3xl lg:text-4xl">
              {t("auth.courtTitle")}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-300 sm:text-base">
              {t("auth.courtSubtitle")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid max-w-md grid-cols-2 gap-3">
              {cards.map((s) => (
                <div
                  key={s.labelKey}
                  className="rounded-lg border border-white/5 bg-ink-950/65 px-3 py-2 backdrop-blur-sm"
                >
                  <p className="font-mono text-[9px] uppercase tracking-widest text-ink-500">
                    {t(s.labelKey)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-100 sm:text-base">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex max-w-md flex-wrap items-center gap-x-2 gap-y-1">
              {LEAGUES.map((l, i) => (
                <span
                  key={l}
                  className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400"
                >
                  {i > 0 ? (
                    <span aria-hidden className="text-ink-600">
                      ·
                    </span>
                  ) : null}
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthCourt
