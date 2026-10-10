"use client"

import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/provider"
import { PlayerPicker } from "@/components/workspace/player-picker"
import { cn } from "@/components/ui/cn"

const LEAGUES: Array<[string, string]> = [
  ["nba", "NBA"],
  ["euroleague", "EuroLeague"],
  ["acb", "ACB"],
  ["leb-oro", "Primera FEB"],
  ["leb-plata", "Segunda FEB"],
  ["eba", "Tercera FEB"],
]

export function ProjectionControls({
  player,
  playerName,
  from,
  to,
}: {
  player: string | null
  playerName: string | null
  from: string | null
  to: string | null
}) {
  const t = useT()
  const router = useRouter()
  const go = (p: string | null, target: string | null) => {
    const q = new URLSearchParams()
    if (p) q.set("player", p)
    if (target) q.set("to", target)
    router.push(`/projection${q.size ? `?${q}` : ""}`)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {t("scouting.projection.pickPlayer")}
          {playerName ? <span className="ml-2 normal-case tracking-normal text-ink-200">{playerName}</span> : null}
        </span>
        <PlayerPicker
          label={t("scouting.projection.pickPlayer")}
          placeholder={t("scouting.projection.pickPlayerPlaceholder")}
          onPick={(p) => go(p.slug, null)}
        />
      </label>
      {player ? (
        <div>
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            {t("scouting.projection.target")}
          </span>
          <div role="group" aria-label={t("scouting.projection.target")} className="flex flex-wrap gap-1.5">
            {LEAGUES.filter(([slug]) => slug !== from).map(([slug, label]) => (
              <button
                key={slug}
                type="button"
                aria-pressed={slug === to}
                onClick={() => go(player, slug)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  slug === to
                    ? "border-brand-500/60 bg-brand-500/15 text-brand-200"
                    : "border-hairline text-ink-300 hover:border-brand-400/40 hover:text-ink-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
