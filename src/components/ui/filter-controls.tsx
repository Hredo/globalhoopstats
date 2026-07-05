"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LEAGUE_FILTER_TREE } from "@/lib/league-groups"
import { leagueAccent } from "@/components/ui/league-badge"
import type { ClientTranslator } from "@/lib/i18n/provider"

/**
 * Shared directory-style filter controls. Used by both the in-page directory
 * filters (`directory-controls`) and the global player search palette so the
 * league/sort dropdowns look and behave identically everywhere.
 */

export function flattenLeagueOptions(t: ClientTranslator) {
  const items: { value: string; label: string; depth: number }[] = [
    { value: "", label: t("directory.allLeagues"), depth: 0 },
  ]
  for (const node of LEAGUE_FILTER_TREE) {
    if (node.children) {
      items.push({
        value: node.slug,
        label: t("directory.allGroup", { label: node.label }),
        depth: 0,
      })
      for (const child of node.children) {
        items.push({ value: child.slug, label: child.label, depth: 1 })
      }
    } else {
      items.push({ value: node.slug, label: node.label, depth: 0 })
    }
  }
  return items
}

export function LeagueSelect({
  value,
  onChange,
  t,
}: {
  value: string
  onChange: (value: string) => void
  t: ClientTranslator
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const options = useMemo(() => flattenLeagueOptions(t), [t])
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? t("directory.allLeagues")
  const selectedAccent = value ? leagueAccent(value) : null

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [search, options])

  const close = useCallback(() => {
    setOpen(false)
    setSearch("")
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [close])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("directory.filterByLeague")}
        className="flex h-9 min-w-[130px] items-center gap-1.5 rounded-full border border-hairline bg-surface-1/80 px-3.5 text-xs font-semibold text-ink-50 outline-none transition duration-200 hover:border-hairline-strong hover:bg-surface-2/80"
      >
        {selectedAccent ? (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full transition-colors duration-300"
            style={{ background: selectedAccent.color }}
          />
        ) : (
          <svg
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-brand-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v4M22 12h-4M12 18v4M6 12H2" />
          </svg>
        )}
        <span className="truncate">{selectedLabel}</span>
        <svg
          aria-hidden
          className={`ml-auto h-3 w-3 shrink-0 text-ink-400 transition-transform duration-300 ease-fluid ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("directory.leaguesListAria")}
          className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-2xl border border-hairline bg-surface-2/95 p-1.5 shadow-[var(--shadow-court)] backdrop-blur-xl sm:left-auto sm:right-0"
        >
          <div className="relative mb-1">
            <svg
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21 21-4.3-4.3M16.65 10.65a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("directory.searchLeagues")}
              aria-label={t("directory.searchLeaguesAria")}
              className="h-8 w-full rounded-xl border border-hairline bg-surface-0/80 pl-8 pr-2.5 text-xs text-ink-50 outline-none placeholder:text-ink-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value)
                  close()
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors duration-200 ${
                  opt.value === value
                    ? "bg-brand-500/15 text-brand-200"
                    : "text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
                }`}
                style={{ paddingLeft: opt.depth > 0 ? "2rem" : "0.625rem" }}
              >
                {opt.depth === 0 && opt.value !== "" ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500/70" />
                ) : opt.depth > 0 ? (
                  <span className="h-1 w-1 shrink-0 rounded-full bg-brand-500/50" />
                ) : null}
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-center text-xs text-ink-400">
                {t("directory.noLeagues")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SelectControl({
  ariaLabel,
  value,
  onChange,
  className = "",
  children,
}: {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-full border border-hairline bg-surface-1/80 pl-3.5 pr-8 text-xs font-semibold text-ink-50 outline-none transition duration-200 hover:border-hairline-strong hover:bg-surface-2/80 focus:border-brand-400/50"
      >
        {children}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
