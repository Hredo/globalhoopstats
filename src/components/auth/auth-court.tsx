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
      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-surface-2 via-surface-1 to-surface-2">
        {/* Court floor pattern overlay — ink-based so it reads on light + dark */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 3px, color-mix(in oklab, var(--color-ink-500) 7%, transparent) 3px, color-mix(in oklab, var(--color-ink-500) 7%, transparent) 4px), repeating-linear-gradient(0deg, transparent, transparent 3px, color-mix(in oklab, var(--color-ink-500) 5%, transparent) 3px, color-mix(in oklab, var(--color-ink-500) 5%, transparent) 4px)",
          }}
        />

        {/* radial spotlight so the 1v1 duel reads as staged under arena light */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 55% at 50% 38%, oklch(0.72 0.205 50 / 0.16), transparent 68%)",
          }}
        />

        {sceneOn ? (
          <AuthDuel className="absolute inset-0 h-full w-full" />
        ) : null}

        {/* legible scrim under the copy — uses the page surface so it works in
            both themes (dark scrim on dark, light scrim on light) */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface-0 via-surface-0/55 to-transparent"
        />
        {/* soft top scrim to seat the title/eyebrow */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-surface-0/70 to-transparent"
        />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-8 sm:p-12">
          <div>
            <span className="gh-eyebrow !text-brand-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
              </span>
              globalhoopstats
            </span>
            <h2 className="gh-title-rule mt-4 max-w-md font-display text-2xl font-semibold leading-[1.02] text-ink-50 sm:text-3xl lg:text-[2.6rem]">
              {t("auth.courtTitle")}
            </h2>
            <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-ink-200 sm:text-base">
              {t("auth.courtSubtitle")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid max-w-md grid-cols-2 gap-3">
              {cards.map((s) => (
                <div
                  key={s.labelKey}
                  className="rounded-xl border border-hairline bg-surface-1/80 px-3.5 py-2.5 shadow-sm backdrop-blur-md"
                >
                  <p className="font-mono text-[9px] uppercase tracking-widest text-ink-500">
                    {t(s.labelKey)}
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-50 sm:text-xl">
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
