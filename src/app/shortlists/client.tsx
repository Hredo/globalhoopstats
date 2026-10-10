"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useT } from "@/lib/i18n/provider"
import { formatRelativeAgo } from "@/lib/format-time"
import { fieldClass, primaryButton } from "@/components/workspace/popover"

type List = {
  id: string
  name: string
  description: string | null
  ownerName: string
  shared: boolean
  items: number
  targets: number
  updatedAt: string
}

export function ShortlistsClient() {
  const t = useT()
  const router = useRouter()
  const [lists, setLists] = useState<List[] | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/shortlists", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ shortlists: List[] }>)
      .then((d) => setLists(d.shortlists))
      .catch(() => setLists([]))
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const r = await fetch("/api/shortlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    })
    const d = (await r.json()) as { id?: string }
    setBusy(false)
    if (d.id) router.push(`/shortlists/${d.id}`)
  }

  const mine = (lists ?? []).filter((l) => !l.shared)
  const shared = (lists ?? []).filter((l) => l.shared)

  const Card = ({ l }: { l: List }) => (
    <Link
      href={`/shortlists/${l.id}`}
      className="gh-card gh-card-interactive group flex flex-col justify-between gap-6 p-5"
    >
      <div>
        <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-ink-50 group-hover:text-brand-200">{l.name}</h3>
        {l.description ? <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-400">{l.description}</p> : null}
        {l.shared ? <p className="mt-1 text-[12px] text-ink-500">{t("shortlistsPage.owner", { name: l.ownerName })}</p> : null}
      </div>
      <div className="flex items-end justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
        <span>
          <span className="block font-display text-3xl font-bold normal-case tracking-[-0.03em] text-ink-50">{l.items}</span>
          {t("shortlistsPage.playersLabel")}
        </span>
        <span className="text-right">
          {l.targets > 0 ? <span className="block text-brand-300">{t("shortlistsPage.targets", { n: l.targets })}</span> : null}
          {t("shortlistsPage.updated", { ago: formatRelativeAgo(new Date(l.updatedAt), t) })}
        </span>
      </div>
    </Link>
  )

  return (
    <div className="mt-8 space-y-10">
      <form onSubmit={create} className="gh-card grid gap-3 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end sm:p-5">
        <label>
          <span className="mb-1 block text-[11.5px] text-ink-400">{t("shortlistsPage.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={fieldClass} placeholder={t("workspace.shortlist.newListPlaceholder")} />
        </label>
        <label>
          <span className="mb-1 block text-[11.5px] text-ink-400">{t("shortlistsPage.description")}</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={fieldClass} />
        </label>
        <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
          {t("shortlistsPage.create")}
        </button>
      </form>

      {lists === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="gh-card h-44 animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <p className="max-w-xl text-sm leading-relaxed text-ink-400">{t("shortlistsPage.empty")}</p>
      ) : (
        <>
          {mine.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((l) => (
                <Card key={l.id} l={l} />
              ))}
            </div>
          ) : null}
          {shared.length ? (
            <section>
              <h2 className="gh-eyebrow mb-4">{t("shortlistsPage.shared")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shared.map((l) => (
                  <Card key={l.id} l={l} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
