"use client"

import { useEffect, useId, useRef, useState } from "react"
import { cn } from "@/components/ui/cn"
import { fieldClass } from "@/components/workspace/popover"

export type PickedPlayer = {
  slug: string
  fullName: string
  team: { name: string } | null
  league: { name: string; slug: string }
}

/**
 * A plain combobox over the existing player search API: type, arrow through
 * the results, Enter to pick. Used where a player is chosen to act on (add to
 * a shortlist, project) rather than navigated to.
 */
export function PlayerPicker({
  onPick,
  placeholder,
  label,
  autoFocus,
}: {
  onPick: (p: PickedPlayer) => void
  placeholder: string
  label: string
  autoFocus?: boolean
}) {
  const id = useId()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<PickedPlayer[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const query = q.trim()
    if (query.length < 2) {
      setResults([]) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/compare/players/search?q=${encodeURIComponent(query)}&limit=8`)
        const d = (await r.json()) as { results?: PickedPlayer[] }
        setResults(d.results ?? [])
        setActive(0)
        setOpen(true)
      } catch {
        setResults([])
      }
    }, 180)
  }, [q])

  function pick(p: PickedPlayer) {
    onPick(p)
    setQ("")
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open && results.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => Math.min(results.length - 1, a + 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault()
            pick(results[active]!)
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
        className={fieldClass}
      />
      {open && results.length > 0 ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-hairline bg-surface-2 p-1 shadow-[var(--shadow-court)]"
        >
          {results.map((p, i) => (
            <li
              key={p.slug}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(p)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                i === active ? "bg-white/[0.06] text-ink-50" : "text-ink-200",
              )}
            >
              <span className="truncate font-medium">{p.fullName}</span>
              <span className="shrink-0 truncate text-[11.5px] text-ink-500">
                {p.team?.name ? `${p.team.name} · ` : ""}
                {p.league.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
