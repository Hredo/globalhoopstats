"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { SmartImage } from "@/components/ui/smart-image"
import { useT } from "@/lib/i18n/provider"

type PlayerHit = {
  id: string
  slug: string
  fullName: string
  position: string | null
  imageUrl: string | null
  team: { name: string; slug: string; logoUrl: string | null } | null
  league: { name: string; slug: string }
}

type Props = {
  selected: PlayerHit | null
  onSelect: (p: PlayerHit) => void
  /** Optional: when provided, a clear (×) button is shown on the selected chip. */
  onClear?: () => void
  placeholder?: string
  side: "left" | "right" | "neutral"
  excludeSlugs?: string[]
}

const initials = (s: string) =>
  s
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")

/** Per-side accent so "entregas" (left/amber) and "recibes" (right/emerald)
 * read at a glance without resorting to dashed borders. */
const ACCENTS = {
  left: {
    iconBox: "bg-amber-500/15 text-amber-300 ring-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
    focusRing: "focus-within:border-amber-500/50 focus-within:ring-amber-500/20",
    optionActive: "bg-amber-500/10 text-amber-100 ring-amber-500/30",
    bar: "bg-amber-400",
  },
  right: {
    iconBox: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
    focusRing:
      "focus-within:border-emerald-500/50 focus-within:ring-emerald-500/20",
    optionActive: "bg-emerald-500/10 text-emerald-100 ring-emerald-500/30",
    bar: "bg-emerald-400",
  },
  neutral: {
    iconBox: "bg-brand-500/15 text-brand-300 ring-brand-500/20",
    hoverBorder: "hover:border-brand-500/40",
    focusRing: "focus-within:border-brand-500/50 focus-within:ring-brand-500/20",
    optionActive: "bg-brand-500/10 text-brand-100 ring-brand-500/30",
    bar: "bg-brand-400",
  },
} as const

export function PlayerSearchPopover({
  selected,
  onSelect,
  onClear,
  placeholder,
  side,
  excludeSlugs = [],
}: Props) {
  const t = useT()
  const resolvedPlaceholder = placeholder ?? t("trade.form.searchPlayer")
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [results, setResults] = useState<PlayerHit[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listboxId = useId()
  const accent = ACCENTS[side]

  const search = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setResults([])
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(query)}&limit=12`,
          { signal: ac.signal },
        )
        if (!res.ok) return
        const data = await res.json()
        const filtered = (data.results ?? []).filter(
          (p: PlayerHit) => !excludeSlugs.includes(p.slug),
        )
        setResults(filtered)
        setActiveIdx(0)
      } catch {
        // ignore aborts
      } finally {
        setLoading(false)
      }
    },
    [excludeSlugs],
  )

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  const pick = (p: PlayerHit) => {
    onSelect(p)
    setOpen(false)
    setQ("")
    setResults([])
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
      scrollTo(activeIdx + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
      scrollTo(activeIdx - 1)
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault()
      pick(results[activeIdx])
    }
  }

  const scrollTo = (idx: number) => {
    const el = listRef.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }

  const openPanel = () => {
    setOpen(true)
    setQ("")
    setResults([])
  }

  // The label shown on the trigger; strip a leading "+" since the icon conveys it.
  const triggerLabel = resolvedPlaceholder.replace(/^\+\s*/, "")

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div
          className={`flex items-center gap-3 rounded-xl border border-hairline bg-surface-2 p-2.5 transition ${accent.hoverBorder}`}
        >
          <span aria-hidden className={`h-9 w-1 shrink-0 rounded-full ${accent.bar}`} />
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-court-800">
            <SmartImage
              src={selected.imageUrl}
              alt={selected.fullName}
              fit="cover"
              fallbackClassName="text-[9px] font-bold text-ink-400"
              fallback={initials(selected.fullName)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-50">
              {selected.fullName}
            </p>
            <p className="truncate font-mono text-[10px] text-ink-400">
              {selected.position ?? "—"} · {selected.team?.name ?? "FA"}
            </p>
          </div>
          <button
            type="button"
            onClick={openPanel}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-300 transition hover:bg-white/[0.06] hover:text-ink-100"
          >
            {t("trade.search.change")}
          </button>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label={t("trade.search.remove")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/[0.06] hover:text-ink-100"
            >
              <XIcon />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={openPanel}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`group flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface-2 p-2.5 text-left transition hover:bg-surface-1 ${accent.hoverBorder}`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${accent.iconBox}`}
          >
            <PlusIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink-100">
              {triggerLabel}
            </span>
            <span className="block font-mono text-[10px] text-ink-500">
              {t("trade.search.searchByName")}
            </span>
          </span>
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-500 transition group-hover:text-ink-300" />
        </button>
      )}

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[var(--shadow-court)]">
          <div className="p-2">
            <div
              className={`relative flex items-center rounded-lg border border-hairline bg-surface-0 transition focus-within:ring-2 ${accent.focusRing}`}
            >
              <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-ink-500" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  search(e.target.value)
                }}
                onKeyDown={onKeyDown}
                placeholder={t("trade.search.typeToSearch")}
                role="combobox"
                aria-expanded
                aria-controls={listboxId}
                aria-activedescendant={
                  results[activeIdx]
                    ? `${listboxId}-${results[activeIdx].slug}`
                    : undefined
                }
                className="w-full bg-transparent py-2.5 pl-9 pr-9 text-sm text-ink-100 placeholder:text-ink-500 outline-none"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("")
                    setResults([])
                    inputRef.current?.focus()
                  }}
                  aria-label={t("trade.search.clear")}
                  className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition hover:bg-white/[0.06] hover:text-ink-100"
                >
                  <XIcon />
                </button>
              ) : null}
            </div>
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-64 overflow-y-auto px-1 pb-1"
          >
            {loading ? (
              <div className="space-y-1 p-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 && q.length >= 2 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-medium text-ink-300">{t("trade.search.noResults")}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {t("trade.search.tryDifferent")}
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm text-ink-400">
                  {t("trade.search.typeAtLeast")}
                </p>
              </div>
            ) : (
              results.map((p, i) => (
                <button
                  key={p.id}
                  id={`${listboxId}-${p.slug}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${
                    i === activeIdx
                      ? `${accent.optionActive} ring-1`
                      : "text-ink-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-court-800">
                    <SmartImage
                      src={p.imageUrl}
                      alt={p.fullName}
                      fit="cover"
                      fallbackClassName="text-[9px] font-bold text-ink-400"
                      fallback={initials(p.fullName)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.fullName}</p>
                    <p className="truncate font-mono text-[10px] text-ink-400">
                      {p.position ?? "—"} · {p.league.name} · {p.team?.name ?? "FA"}
                    </p>
                  </div>
                  <PlusIcon
                    className={`h-4 w-4 shrink-0 transition ${
                      i === activeIdx ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
