"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { cn } from "@/components/ui/cn"
import { leagueAccent } from "@/components/ui/league-badge"

export type LeagueOption = { slug: string; name: string }

function segmentClass(active: boolean): string {
  return cn(
    "rounded-[5px] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition duration-200",
    active ? "text-ink-50" : "text-ink-400 hover:text-ink-200",
  )
}

function Shell({
  ariaLabel,
  children,
}: {
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-surface-1/80 p-1 backdrop-blur"
    >
      {children}
    </div>
  )
}

function activeStyle(slug: string): React.CSSProperties {
  const a = leagueAccent(slug)
  return {
    backgroundColor: `color-mix(in oklch, ${a.color} 22%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${a.color} 45%, transparent)`,
    color: a.text,
  }
}

/**
 * Player profile switcher — toggles the `?league=` query param in place so the
 * server re-renders that league's stats without a full navigation.
 */
export function PlayerLeagueSwitcher({
  leagues,
  activeSlug,
  ariaLabel,
}: {
  leagues: LeagueOption[]
  activeSlug: string
  ariaLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const select = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("league", slug)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  if (leagues.length < 2) return null
  return (
    <Shell ariaLabel={ariaLabel}>
      {leagues.map((l) => {
        const active = l.slug === activeSlug
        return (
          <button
            key={l.slug}
            type="button"
            aria-pressed={active}
            onClick={() => select(l.slug)}
            className={segmentClass(active)}
            style={active ? activeStyle(l.slug) : undefined}
          >
            {l.name}
          </button>
        )
      })}
    </Shell>
  )
}

/**
 * Team profile switcher — the league lives in the route, so each option is a
 * link to that league's page for the same club.
 */
export function TeamLeagueSwitcher({
  leagues,
  activeSlug,
  teamSlug,
  ariaLabel,
}: {
  leagues: LeagueOption[]
  activeSlug: string
  teamSlug: string
  ariaLabel: string
}) {
  if (leagues.length < 2) return null
  return (
    <Shell ariaLabel={ariaLabel}>
      {leagues.map((l) => {
        const active = l.slug === activeSlug
        return (
          <Link
            key={l.slug}
            href={`/teams/${l.slug}/${teamSlug}`}
            aria-current={active ? "page" : undefined}
            className={segmentClass(active)}
            style={active ? activeStyle(l.slug) : undefined}
            scroll={false}
          >
            {l.name}
          </Link>
        )
      })}
    </Shell>
  )
}
