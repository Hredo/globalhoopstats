"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useLocale } from "@/lib/i18n/provider"

type Notice = {
  id: string
  title: string
  content: string | null
  priority: number
  createdAt: string
}

const POLL_MS = 60_000
const DISMISS_KEY = "ghs:dismissed-announcements"

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** A notice with body text opens as a modal; otherwise a banner. */
function isModal(a: Notice): boolean {
  return Boolean(a.content && a.content.trim())
}

export function AnnouncementNotices() {
  const locale = useLocale()
  const [items, setItems] = useState<Notice[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements/active", { cache: "no-store" })
      if (res.ok) setItems((await res.json()) as Notice[])
    } catch {
      /* keep showing whatever we already have */
    }
  }, [])

  // Near-real-time without a page refresh: poll on an interval and whenever the
  // tab regains focus. Polling (not websockets) is the standard for low-volume
  // site notices.
  useEffect(() => {
    const initial = setTimeout(fetchActive, 0)
    const id = setInterval(fetchActive, POLL_MS)
    const onFocus = () => fetchActive()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [fetchActive])

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }, [])

  const visible = useMemo(
    () => items.filter((a) => !dismissed.has(a.id)),
    [items, dismissed],
  )
  const banners = visible.filter((a) => !isModal(a)).slice(0, 3)
  // One modal at a time (highest priority first); closing reveals the next.
  const modal = visible.find(isModal) ?? null

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
        dateStyle: "long",
      }),
    [locale],
  )
  const closeLabel = locale === "es" ? "Cerrar" : "Close"

  // Escape closes the modal.
  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(modal.id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modal, dismiss])

  return (
    <>
      {/* Banner stack — sits just below the navbar, slides down on appearance */}
      <AnimatePresence initial={false}>
        {banners.map((a) => (
          <motion.div
            key={a.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-brand-500/30 bg-brand-500/10"
            role="status"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping bg-brand-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 bg-brand-400" />
              </span>
              <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-ink-50">
                <span className="truncate">{a.title}</span>
                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-400 sm:inline">
                  {dateFmt.format(new Date(a.createdAt))}
                </span>
              </p>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                aria-label={closeLabel}
                className="shrink-0 rounded-md p-1 text-ink-300 transition hover:bg-white/10 hover:text-ink-50"
              >
                <CloseIcon />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Modal — centered, dims the page, must be closed */}
      <AnimatePresence>
        {modal ? (
          <motion.div
            key="ann-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => dismiss(modal.id)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ann-modal-title"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 8, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-surface-1 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => dismiss(modal.id)}
                aria-label={closeLabel}
                className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-ink-200 backdrop-blur transition hover:bg-black/60 hover:text-ink-50"
              >
                <CloseIcon />
              </button>
              <div className="p-6 sm:p-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-300">
                  {dateFmt.format(new Date(modal.createdAt))}
                </p>
                <h2
                  id="ann-modal-title"
                  className="mt-2 font-display text-2xl font-bold text-ink-50"
                >
                  {modal.title}
                </h2>
                {modal.content ? (
                  <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-200">
                    {modal.content}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => dismiss(modal.id)}
                  className="gh-sheen mt-6 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-ink-100 transition hover:bg-white/[0.12]"
                >
                  {closeLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
