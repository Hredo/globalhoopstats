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
      setPlayers([])
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

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : players.length > 0 ? (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
            {t("playbook.roster.dragHint")}
          </p>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
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
                      "flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left transition hover:border-hairline hover:bg-white/[0.04] active:cursor-grabbing",
                      used && "opacity-45",
                    )}
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-court-800">
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
                      <p className="font-mono text-[10px] text-ink-400">
                        {p.position ?? "—"} · {p.league.name}
                      </p>
                    </div>
                    {used ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-brand-300">
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
        <p className="py-6 text-center text-sm text-ink-400">
          {t("playbook.roster.empty")}
        </p>
      ) : (
        <p className="py-6 text-center text-sm text-ink-400">
          {t("playbook.roster.pickTeamHint")}
        </p>
      )}
    </div>
  )
}
