"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { NavIcon } from "@/components/layout/nav-icons"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import { useSession } from "@/lib/auth/use-session"
import {
  ActionPopover,
  actionButton,
  actionIdle,
  fieldClass,
  primaryButton,
} from "@/components/workspace/popover"

type List = { id: string; name: string; items: number; shared: boolean }

export function AddToShortlist({ slug }: { slug: string }) {
  const t = useT()
  const pathname = usePathname()
  const { user, status } = useSession()
  const [lists, setLists] = useState<List[] | null>(null)
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  if (status === "loading") return <span className={cn(actionButton, actionIdle, "w-32 animate-pulse")} />
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cn(actionButton, actionIdle)}>
        <NavIcon name="shortlists" className="h-3.5 w-3.5" />
        {t("workspace.shortlist.signIn")}
      </Link>
    )
  }

  async function load() {
    const r = await fetch("/api/shortlists", { cache: "no-store" })
    const d = (await r.json()) as { shortlists: List[] }
    setLists(d.shortlists)
  }

  async function addTo(id: string) {
    setBusy(true)
    try {
      const r = await fetch(`/api/shortlists/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      if (r.ok) setAdded((a) => ({ ...a, [id]: true }))
    } finally {
      setBusy(false)
    }
  }

  async function createAndAdd() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const r = await fetch("/api/shortlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const d = (await r.json()) as { id?: string }
      if (d.id) {
        await addTo(d.id)
        setName("")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionPopover
      label={t("workspace.shortlist.pick")}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={() => {
            toggle()
            if (!lists) void load()
          }}
          className={cn(actionButton, actionIdle)}
        >
          <NavIcon name="shortlists" className="h-3.5 w-3.5" />
          {t("workspace.shortlist.add")}
        </button>
      )}
    >
      {() => (
        <div className="space-y-3">
          <p className="gh-eyebrow">{t("workspace.shortlist.pick")}</p>
          {lists === null ? (
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />
          ) : lists.length === 0 ? (
            <p className="text-[12.5px] text-ink-400">{t("workspace.shortlist.empty")}</p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {lists.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={busy || added[l.id]}
                    onClick={() => addTo(l.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 transition-colors hover:bg-white/[0.05] disabled:cursor-default"
                  >
                    <span className="truncate">{l.name}</span>
                    {added[l.id] ? (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-positive">✓</span>
                    ) : (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-500">{l.items}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2 border-t border-hairline pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              void createAndAdd()
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder={t("workspace.shortlist.newListPlaceholder")}
              aria-label={t("workspace.shortlist.newList")}
              className={fieldClass}
            />
            <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
              {t("workspace.shortlist.create")}
            </button>
          </form>
        </div>
      )}
    </ActionPopover>
  )
}
