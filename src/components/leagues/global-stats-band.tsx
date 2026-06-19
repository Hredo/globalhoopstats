"use client"

import { CountUp } from "@/components/marketing/count-up"
import { useT } from "@/lib/i18n/provider"

type Stat = {
  value: number
  labelKey: string
  accent: "brand" | "cyan" | "magenta" | "lime"
}

type Props = {
  counts: {
    leagues: number
    players: number
    teams: number
    coaches: number
  }
}

const ACCENT_TEXT: Record<Stat["accent"], string> = {
  brand: "text-brand-400",
  cyan: "text-accent-cyan",
  magenta: "text-accent-magenta",
  lime: "text-accent-lime",
}

export function GlobalStatsBand({ counts }: Props) {
  const t = useT()
  const stats: Stat[] = [
    {
      value: counts.leagues,
      labelKey: "directory.leagues.statLeaguesLive",
      accent: "brand",
    },
    {
      value: counts.players,
      labelKey: "directory.leagues.statPlayersIndexed",
      accent: "cyan",
    },
    {
      value: counts.teams,
      labelKey: "directory.leagues.statTeamsTracked",
      accent: "magenta",
    },
    {
      value: counts.coaches,
      labelKey: "directory.leagues.statCoaches",
      accent: "lime",
    },
  ]
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((s) => (
        <div
          key={s.labelKey}
          className="relative overflow-hidden rounded-xl border border-white/15 bg-surface-1 px-4 py-3 sm:px-5 sm:py-4"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <p
            className={`font-display text-2xl font-bold tabular-nums sm:text-3xl ${ACCENT_TEXT[s.accent]}`}
          >
            <CountUp to={s.value} duration={1100} />
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300 sm:text-[11px]">
            {t(s.labelKey)}
          </p>
        </div>
      ))}
    </div>
  )
}
