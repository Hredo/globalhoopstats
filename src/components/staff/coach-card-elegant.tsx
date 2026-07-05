"use client"

import Link from "next/link"
import { SmartImage } from "@/components/ui/smart-image"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { leagueAccent } from "@/components/ui/league-badge"
import { useSpotlight } from "@/components/animations/spotlight-card"
import { getInitials } from "@/lib/format"
import { useT } from "@/lib/i18n/provider"

const ROLE_LABEL_KEY: Record<string, string> = {
  head_coach: "directory.roles.headCoach",
  assistant_coach: "directory.roles.assistant",
  staff: "directory.roles.staff",
}

const ROLE_DOT: Record<string, string> = {
  head_coach: "bg-brand-400",
  assistant_coach: "bg-accent-cyan",
  staff: "bg-ink-400",
}

type Props = {
  coach: {
    id: string
    fullName: string
    slug: string
    role: "head_coach" | "assistant_coach" | "staff"
    photoUrl: string | null
    team: { id: string; name: string; slug: string; logoUrl: string | null }
    league: { id: string; name: string; slug: string; region: string }
  }
}

export function CoachCardElegant({ coach }: Props) {
  const t = useT()
  const label = ROLE_LABEL_KEY[coach.role]
    ? t(ROLE_LABEL_KEY[coach.role])
    : coach.role
  const dot = ROLE_DOT[coach.role] ?? ROLE_DOT.staff
  const accent = leagueAccent(coach.league.slug)
  const { ref, onPointerMove } = useSpotlight<HTMLAnchorElement>()

  return (
    <Link
      ref={ref}
      onPointerMove={onPointerMove}
      href={`/teams/${coach.league.slug}/${coach.team.slug}`}
      className="gh-card gh-card-interactive gh-spotlight group relative flex h-full flex-col items-center gap-2 overflow-hidden p-2.5 text-center sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:text-left"
      style={{ ["--lg" as string]: accent.color }}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-3 ring-1 ring-hairline sm:h-[72px] sm:w-[72px]">
        <SmartImage
          src={coach.photoUrl}
          alt={coach.fullName}
          fit="cover"
          className="h-full w-full transition-transform duration-700 ease-fluid group-hover:scale-[1.07]"
          fallback={
            <PersonAvatar
              name={coach.fullName}
              leagueSlug={coach.league.slug}
            />
          }
        />
      </div>
      <div className="min-w-0 w-full flex-1">
        <div className="flex items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 ${dot}`} />
          <span className="text-condensed truncate text-[8px] tracking-[0.14em] text-ink-400 sm:text-[9px] sm:tracking-[0.16em]">
            {label}
          </span>
        </div>
        <h3 className="mt-1 truncate font-display text-xs font-bold tracking-[-0.01em] text-ink-50 sm:text-lg">
          {coach.fullName}
        </h3>
        <div className="mt-1 flex items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
          {coach.team.logoUrl ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-3 p-0.5 ring-1 ring-hairline">
              <SmartImage
                src={coach.team.logoUrl}
                alt={coach.team.name}
                fit="contain"
                fallbackClassName="text-[7px] font-bold text-ink-300"
                fallback={getInitials(coach.team.name, 2)}
              />
            </span>
          ) : null}
          <p className="truncate text-[10px] text-ink-300 sm:text-xs">{coach.team.name}</p>
        </div>
      </div>
    </Link>
  )
}
