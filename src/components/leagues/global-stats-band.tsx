"use client"

import { CountUp } from "@/components/marketing/count-up"
import { useT } from "@/lib/i18n/provider"

type Accent = "brand" | "cyan" | "magenta" | "lime"

type Stat = {
  value: number
  labelKey: string
  accent: Accent
}

type Props = {
  counts: {
    leagues: number
    players: number
    teams: number
    coaches: number
  }
}

const ACCENT_TEXT: Record<Accent, string> = {
  brand: "text-brand-400",
  cyan: "text-accent-cyan",
  magenta: "text-accent-magenta",
  lime: "text-accent-lime",
}

// CSS-variable colour for each accent, used for the bar, glow and hover ring.
const ACCENT_VAR: Record<Accent, string> = {
  brand: "var(--color-brand-500)",
  cyan: "var(--color-accent-cyan)",
  magenta: "var(--color-accent-magenta)",
  lime: "var(--color-accent-lime)",
}

export function GlobalStatsBand({ counts }: Props) {
  const t = useT()
  const stats: Stat[] = [
    { value: counts.leagues, labelKey: "directory.leagues.statLeaguesLive", accent: "brand" },
    { value: counts.players, labelKey: "directory.leagues.statPlayersIndexed", accent: "cyan" },
    { value: counts.teams, labelKey: "directory.leagues.statTeamsTracked", accent: "magenta" },
    { value: counts.coaches, labelKey: "directory.leagues.statCoaches", accent: "lime" },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((s) => {
        const c = ACCENT_VAR[s.accent]
        return (
          <div
            key={s.labelKey}
            className="group relative overflow-hidden rounded-2xl border border-white/12 bg-surface-1 px-4 py-4 ring-1 ring-inset ring-white/[0.04] transition duration-300 hover:-translate-y-0.5 hover:border-white/25 sm:px-5 sm:py-5"
            style={{ ["--c" as string]: c }}
          >
            {/* accent bar */}
            <span
              aria-hidden
              className="absolute inset-y-3 left-0 w-[3px] rounded-full opacity-80"
              style={{ background: "var(--c)" }}
            />
            {/* corner glow, lifts on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
              style={{ background: "var(--c)" }}
            />
            <div className="relative flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--c)" }}
              />
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-400 sm:text-[10px]">
                {t(s.labelKey)}
              </p>
            </div>
            <p
              className={`relative mt-2 font-display text-3xl font-bold tabular-nums leading-none sm:text-[2.6rem] ${ACCENT_TEXT[s.accent]}`}
            >
              <CountUp to={s.value} duration={1100} />
            </p>
          </div>
        )
      })}
    </div>
  )
}
