"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/components/ui/cn"
import { useLocale, useT } from "@/lib/i18n/provider"
import { useSession } from "@/lib/auth/use-session"
import {
  ActionPopover,
  actionButton,
  actionIdle,
  fieldClass,
  primaryButton,
} from "@/components/workspace/popover"

type Share = { id: string; url: string; views: number; expiresAt: string; active: boolean; targetId: string }

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  )
}

/**
 * Creates and manages read-only links to a player report, a shortlist or a
 * play. `targetId` lets the popover list the links already made for this exact
 * thing (shortlists and plays pass their id; players pass none and see all
 * player links by kind).
 */
export function ShareButton({
  kind,
  refId,
  targetId,
  align = "left",
}: {
  kind: "player" | "shortlist" | "play"
  refId: string
  targetId?: string
  align?: "left" | "right"
}) {
  const t = useT()
  const locale = useLocale()
  const pathname = usePathname()
  const { user, status } = useSession()
  const [note, setNote] = useState("")
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState<Share[] | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (status === "loading") return <span className={cn(actionButton, actionIdle, "w-24 animate-pulse")} />
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cn(actionButton, actionIdle)}>
        <ShareIcon className="h-3.5 w-3.5" />
        {t("workspace.share.signIn")}
      </Link>
    )
  }

  async function load() {
    const q = new URLSearchParams({ kind })
    if (targetId) q.set("target", targetId)
    const r = await fetch(`/api/shares?${q}`, { cache: "no-store" })
    const d = (await r.json()) as { shares: Share[] }
    setLinks(d.shares.filter((s) => s.active).slice(0, 5))
  }

  async function create() {
    setBusy(true)
    try {
      const r = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ref: refId, note: note.trim() || null, days }),
      })
      const d = (await r.json()) as { url?: string }
      if (d.url) {
        await copy(d.url)
        setNote("")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      // Clipboard can be blocked; the URL is still on screen to copy by hand.
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/shares?id=${id}`, { method: "DELETE" })
    setLinks((l) => l?.filter((s) => s.id !== id) ?? l)
  }

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short" })

  return (
    <ActionPopover
      align={align}
      label={t("workspace.share.title")}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={() => {
            toggle()
            if (!links) void load()
          }}
          className={cn(actionButton, actionIdle)}
        >
          <ShareIcon className="h-3.5 w-3.5" />
          {t("workspace.share.button")}
        </button>
      )}
    >
      {() => (
        <div className="space-y-3">
          <p className="gh-eyebrow">{t("workspace.share.title")}</p>
          <p className="text-[12.5px] leading-relaxed text-ink-400">{t("workspace.share.hint")}</p>
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-ink-400">{t("workspace.share.note")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t("workspace.share.notePlaceholder")}
              className={cn(fieldClass, "resize-none")}
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <div role="group" aria-label={t("workspace.share.expires")} className="inline-flex rounded-lg border border-hairline p-0.5">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                    days === d ? "bg-white/[0.08] text-ink-50" : "text-ink-400 hover:text-ink-100",
                  )}
                >
                  {t("workspace.share.days", { n: d })}
                </button>
              ))}
            </div>
            <button type="button" onClick={create} disabled={busy} className={primaryButton}>
              {t("workspace.share.create")}
            </button>
          </div>
          {links && links.length > 0 ? (
            <div className="border-t border-hairline pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{t("workspace.share.active")}</p>
              <ul className="space-y-1.5">
                {links.map((l) => (
                  <li key={l.id} className="rounded-lg border border-hairline p-2">
                    <p className="truncate font-mono text-[11px] text-ink-300">{l.url}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-ink-500">
                      <span>
                        {t("workspace.share.views", { n: l.views })} · {t("workspace.share.expiresOn", { date: date(l.expiresAt) })}
                      </span>
                      <span className="flex gap-3">
                        <button type="button" onClick={() => copy(l.url)} className="font-medium text-brand-300 hover:text-brand-200">
                          {copied === l.url ? t("workspace.share.copied") : t("workspace.share.copy")}
                        </button>
                        <button type="button" onClick={() => revoke(l.id)} className="font-medium text-ink-400 hover:text-red-300">
                          {t("workspace.share.revoke")}
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </ActionPopover>
  )
}
