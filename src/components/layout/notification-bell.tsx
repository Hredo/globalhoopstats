"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { NavIcon } from "@/components/layout/nav-icons"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import { useSession } from "@/lib/auth/use-session"
import { formatRelativeAgo } from "@/lib/format-time"

type Item = {
  id: string
  kind: string
  title: string
  body: string | null
  href: string | null
  readAt: string | null
  createdAt: string
}

/** Polled once a minute while the tab is visible — alerts arrive after syncs, not by the second. */
const POLL_MS = 60_000

export function NotificationBell({ className }: { className?: string }) {
  const t = useT()
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Item[] | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications?limit=12", { cache: "no-store" })
      if (!r.ok) return
      const d = (await r.json()) as { unread: number; items: Item[] }
      setUnread(d.unread)
      setItems(d.items)
    } catch {
      // A missed poll is harmless; the next one catches up.
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void load() // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === "visible" && void load()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [user, load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!user) return null

  async function markAll() {
    setUnread(0)
    setItems((list) => list?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? list)
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {})
  }

  async function markOne(id: string) {
    const item = items?.find((i) => i.id === id)
    if (!item || item.readAt) return
    setUnread((n) => Math.max(0, n - 1))
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `${t("nav.bell.label")} — ${t("nav.bell.unread", { count: unread })}` : t("nav.bell.label")}
        className="relative grid h-9 w-9 place-items-center rounded-full text-ink-300 transition-colors duration-300 hover:bg-white/[0.05] hover:text-ink-50"
      >
        <NavIcon name="bell" className="h-[18px] w-[18px]" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 font-mono text-[9px] font-bold text-ink-950">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <div
        role="dialog"
        aria-label={t("nav.bell.label")}
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-1rem))] origin-top-right rounded-2xl border border-hairline bg-surface-2/95 shadow-[var(--shadow-court)] backdrop-blur-xl transition-all duration-200 ease-fluid",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1.5 opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <p className="text-[13px] font-semibold text-ink-50">{t("nav.bell.label")}</p>
          {unread > 0 ? (
            <button
              type="button"
              tabIndex={open ? undefined : -1}
              onClick={markAll}
              className="text-[12px] font-medium text-brand-300 hover:text-brand-200"
            >
              {t("nav.bell.markAll")}
            </button>
          ) : null}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-1.5">
          {items && items.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12.5px] leading-relaxed text-ink-400">{t("nav.bell.empty")}</li>
          ) : null}
          {(items ?? []).map((n) => (
            <li key={n.id}>
              <Link
                href={n.href ?? "/following"}
                tabIndex={open ? undefined : -1}
                onClick={() => {
                  void markOne(n.id)
                  setOpen(false)
                }}
                className="flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-snug text-ink-100">{n.title}</span>
                  {n.body ? <span className="mt-0.5 block text-[12px] leading-snug text-ink-400">{n.body}</span> : null}
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                    {formatRelativeAgo(new Date(n.createdAt), t)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-hairline p-1.5">
          <Link
            href="/following"
            tabIndex={open ? undefined : -1}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-center text-[12.5px] font-medium text-ink-300 transition-colors hover:bg-white/[0.04] hover:text-ink-50"
          >
            {t("nav.bell.seeAll")}
          </Link>
        </div>
      </div>
    </div>
  )
}
