"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/components/ui/cn"
import { SmartImage } from "@/components/ui/smart-image"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { useT } from "@/lib/i18n/provider"
import type { LinkedPlayer } from "@/lib/playbook/types"
import { PLAYER_DRAG_MIME } from "@/components/playbook/editor"
import type { EditorState, PlayDispatch } from "@/components/playbook/play-state"

type TeamOption = { id: string; name: string; slug: string; leagueSlug: string }

type RosterHit = {
  slug: string
  fullName: string
  position: string | null
  imageUrl: string | null
  league: { name: string; slug: string }
}

/**
 * Pick any team in the database and drag its real players onto the board
 * (or click to assign to the selected token). This is the piece none of the
 * playbook competitors have — plays drawn with your actual roster.
 */
export function RosterPanel({
  state,
  dispatch,
}: {
  state: EditorState
  dispatch: PlayDispatch
}) {
  const t = useT()
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [league, setLeague] = useState("")
  const [teamSlug, setTeamSlug] = useState("")
  const [players, setPlayers] = useState<RosterHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/teams/options")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: TeamOption[]) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => setError(t("playbook.roster.loadError")))
  }, [t])

  const leagues = useMemo(() => {
    const set = new Set(teams.map((x) => x.leagueSlug))
    return [...set].sort()
  }, [teams])

  const leagueTeams = useMemo(
    () => teams.filter((x) => !league || x.leagueSlug === league),
    [teams, league],
  )

  const selectedTeam = teams.find(
    (x) => x.slug === teamSlug && (!league || x.leagueSlug === league),
  )

  useEffect(() => {
    if (!selectedTeam) {
      setPlayers([]) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    let cancelled = false
    setLoading(true)
    setError("")
    const params = new URLSearchParams({
      league: selectedTeam.leagueSlug,
      team: selectedTeam.name,
      sort: "name",
      order: "asc",
      pageSize: "50",
    })
    fetch(`/api/players/list?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { items?: RosterHit[] }) => {
        if (!cancelled) setPlayers(data.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(t("playbook.roster.loadError"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam?.slug, selectedTeam?.leagueSlug])

  const assignedSlugs = new Set(
    state.play.elements
      .map((e) => e.player?.slug)
      .filter((s): s is string => !!s),
  )

  const toLinked = (p: RosterHit): LinkedPlayer => ({
    slug: p.slug,
    name: p.fullName,
    position: p.position,
    imageUrl: p.imageUrl,
  })

  const onPick = (p: RosterHit) => {
    const selected = state.selectedElementId
      ? state.play.elements.find((e) => e.id === state.selectedElementId)
      : null
    if (selected && selected.kind === "attacker") {
      dispatch({ type: "assign-player", elementId: selected.id, player: toLinked(p) })
      return
    }
    // No attacker selected: fill the first token without a player.
    const free = state.play.elements.find(
      (e) => e.kind === "attacker" && !e.player,
    )
    if (free) {
      dispatch({ type: "assign-player", elementId: free.id, player: toLinked(p) })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={league}
          onChange={(e) => {
            setLeague(e.target.value)
            setTeamSlug("")
          }}
          aria-label={t("playbook.roster.league")}
          className="gh-input w-full text-sm"
        >
          <option value="">{t("playbook.roster.allLeagues")}</option>
          {leagues.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase().replace(/-/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={teamSlug}
          onChange={(e) => {
            setTeamSlug(e.target.value)
            const team = teams.find((x) => x.slug === e.target.value)
            dispatch({
              type: "set-team",
              team: team
                ? { slug: team.slug, name: team.name, leagueSlug: team.leagueSlug }
                : null,
            })
          }}
          aria-label={t("playbook.roster.team")}
          className="gh-input w-full text-sm"
        >
          <option value="">{t("playbook.roster.pickTeam")}</option>
          {leagueTeams.map((x) => (
            <option key={`${x.leagueSlug}:${x.slug}`} value={x.slug}>
              {x.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : players.length > 0 ? (
        <>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500"><path d="M12 5v14M5 12h14" /></svg>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              {t("playbook.roster.dragHint")}
            </span>
            <span className="ml-auto font-mono text-[10px] text-ink-400">{players.length}</span>
          </div>
          <ul className="max-h-[360px] space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
            {players.map((p) => {
              const used = assignedSlugs.has(p.slug)
              return (
                <li key={p.slug}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        PLAYER_DRAG_MIME,
                        JSON.stringify(toLinked(p)),
                      )
                      e.dataTransfer.effectAllowed = "copy"
                    }}
                    onClick={() => onPick(p)}
                    className={cn(
                      "flex w-full cursor-grab items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-white/[0.04] active:cursor-grabbing",
                      used && "opacity-40",
                    )}
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-court-800 ring-1 ring-white/[0.06]">
                      <SmartImage
                        src={p.imageUrl}
                        alt={p.fullName}
                        fit="cover"
                        fallback={
                          <PersonAvatar name={p.fullName} leagueSlug={p.league.slug} />
                        }
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink-100">
                        {p.fullName}
                      </p>
                      <p className="font-mono text-[11px] text-ink-300">
                        {p.position ?? "—"} <span className="text-ink-500">·</span> {p.league.name}
                      </p>
                    </div>
                    {used ? (
                      <span className="shrink-0 rounded bg-brand-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-300">
                        {t("playbook.roster.onCourt")}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : selectedTeam ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-500/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-500"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 10-16 0" /></svg>
          </div>
          <p className="text-sm font-semibold text-ink-200">{t("playbook.roster.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-500/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-500"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
          </div>
          <p className="text-sm font-semibold text-ink-200">{t("playbook.roster.pickTeamHint")}</p>
        </div>
      )}
    </div>
  )
}
