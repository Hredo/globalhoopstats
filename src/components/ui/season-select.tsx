"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { SelectControl } from "@/components/ui/filter-controls"
import { useT, type ClientTranslator } from "@/lib/i18n/provider"

/**
 * Season switcher for the directories and profiles.
 *
 * Deliberately a plain `<select>` rather than the custom popover the league
 * filter uses: there are a handful of options, no search is needed, and a
 * native control is the one thing that behaves identically on a phone.
 *
 * The newest season is always first and is what the page shows when no season
 * is in the URL, so the empty value means "newest" rather than "all".
 */
export function SeasonSelect({
  seasons,
  value,
  onChange,
  t,
  className,
}: {
  /** Season labels, newest first. */
  seasons: string[]
  /** Currently selected label. */
  value: string
  onChange: (season: string) => void
  t: ClientTranslator
  className?: string
}) {
  // One season is not a choice — rendering a dropdown that cannot change
  // anything just adds a dead control to the filter bar.
  if (seasons.length < 2) return null

  return (
    <SelectControl
      ariaLabel={t("directory.filterBySeason")}
      value={value}
      onChange={onChange}
      className={className}
    >
      {seasons.map((s, i) => (
        <option key={s} value={s}>
          {i === 0
            ? t("directory.seasonCurrent", { season: s })
            : t("directory.seasonPrefix", { season: s })}
        </option>
      ))}
    </SelectControl>
  )
}

/**
 * Season switcher for a profile page (player, team, compare).
 *
 * Writes `?season=` in place and lets the server re-render that season's
 * numbers — same mechanism as the league switcher next to it, so the two
 * controls behave identically. Selecting the newest season clears the param
 * rather than pinning it, keeping the shareable URL the "current" one.
 */
export function SeasonSwitcher({
  seasons,
  active,
}: {
  /** Season labels, newest first. */
  seasons: string[]
  active: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()

  const select = useCallback(
    (season: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (season === seasons[0]) params.delete("season")
      else params.set("season", season)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, seasons],
  )

  return (
    <SeasonSelect
      seasons={seasons}
      value={active}
      onChange={select}
      t={t}
    />
  )
}
