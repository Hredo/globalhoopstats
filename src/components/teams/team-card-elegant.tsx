"use client"

import Link from "next/link"
import { SmartImage } from "@/components/ui/smart-image"
import { leagueAccent } from "@/components/ui/league-badge"
import { useSpotlight } from "@/components/animations/spotlight-card"
import { getInitials } from "@/lib/format"
import { useT } from "@/lib/i18n/provider"

type Props = {
  team: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    city: string | null
    league: { id: string; name: string; slug: string; region: string }
    playerCount: number
  }
}

export function TeamCardElegant({ team }: Props) {
  const t = useT()
  const initials = getInitials(team.name, 3)
  const league = leagueAccent(team.league.slug)
  const accent = league.color
  const { ref, onPointerMove } = useSpotlight<HTMLAnchorElement>()

  return (
    <Link
      ref={ref}
      onPointerMove={onPointerMove}
      href={`/teams/${team.league.slug}/${team.slug}`}
      className="gh-card gh-card-interactive gh-spotlight group relative flex h-full flex-col overflow-hidden"
      style={{ ["--lg" as string]: accent }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[3px] opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "var(--lg)" }}
      />
      <div
        className="relative aspect-[5/3] w-full overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 30%, color-mix(in oklch, ${accent} 22%, transparent) 0%, transparent 68%)`,
        }}
      >
        {team.logoUrl ? (
          <SmartImage
            src={team.logoUrl}
            alt={team.name}
            fit="contain"
            className="relative h-full w-full p-3 transition-transform duration-700 ease-fluid group-hover:scale-[1.07] sm:p-8"
            fallbackClassName="text-3xl font-bold text-ink-300"
            fallback={initials}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-ink-300">
            {initials}
          </div>
        )}
        <span className="text-condensed absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-sm bg-ink-950/60 px-1.5 py-0.5 text-[8px] tracking-[0.1em] text-ink-100 ring-1 ring-hairline backdrop-blur sm:right-3 sm:top-3 sm:gap-1.5 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
          <span
            aria-hidden
            className="h-1.5 w-1.5"
            style={{ background: "var(--lg)" }}
          />
          {team.league.name}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5 hairline-t sm:gap-3 sm:p-4">
        <div>
          <h3 className="truncate font-display text-sm font-bold tracking-[-0.01em] text-ink-50 sm:text-lg">
            {team.name}
          </h3>
          {team.city || team.league.region ? (
            <p className="mt-0.5 truncate text-[10px] text-ink-400 sm:text-xs">
              {team.city ?? team.league.region}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-1">
          <div className="min-w-0">
            <p className="text-condensed text-[8px] tracking-[0.14em] text-ink-500 sm:text-[9px] sm:tracking-[0.16em]">
              {t("directory.rosterLabel")}
            </p>
            <p className="text-numeral truncate text-base text-ink-50 sm:text-lg">
              {team.playerCount}{" "}
              <span className="text-xs font-medium text-ink-400 sm:text-sm">
                {team.playerCount === 1
                  ? t("directory.playerOne")
                  : t("directory.playerOther")}
              </span>
            </p>
          </div>
          <span
            aria-hidden
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-ink-400 ring-1 ring-hairline transition-all duration-300 ease-fluid group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink-50 sm:inline-flex"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
