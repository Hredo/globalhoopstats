"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import { formatRelativeAgo } from "@/lib/format-time"
import { fieldClass, primaryButton } from "@/components/workspace/popover"
import { PlayerPicker } from "@/components/workspace/player-picker"
import { ShareButton } from "@/components/workspace/share-button"
import { SmartImage } from "@/components/ui/smart-image"
import { PersonAvatar } from "@/components/ui/person-avatar"
import type { ShortlistDetail, ShortlistItemView } from "@/lib/workspace/shortlists"

const STATUSES = ["watch", "target", "contact", "discard"] as const
type Status = (typeof STATUSES)[number]
type Detail = ShortlistDetail & { access: "owner" | "editor" | "viewer"; me: string }

const ACCENT: Record<Status, string> = {
  watch: "bg-ink-500",
  target: "bg-brand-500",
  contact: "bg-positive",
  discard: "bg-ink-700",
}

function ItemCard({
  item,
  editable,
  onPatch,
  onRemove,
}: {
  item: ShortlistItemView
  editable: boolean
  onPatch: (patch: { status?: Status; note?: string | null }) => void
  onRemove: () => void
}) {
  const t = useT()
  const [note, setNote] = useState(item.note ?? "")
  const [editing, setEditing] = useState(false)
  const l = item.line
  return (
    <article
      draggable={editable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
      className={cn("rounded-2xl border border-hairline bg-surface-1/80 p-3", editable && "cursor-grab active:cursor-grabbing")}
    >
      <div className="flex items-start gap-3">
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-court-800 ring-1 ring-hairline">
          <SmartImage src={item.player.imageUrl} alt="" fallback={<PersonAvatar name={item.player.fullName} leagueSlug={l?.leagueSlug} />} />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/players/${item.player.slug}`} className="block truncate text-[14px] font-semibold text-ink-50 hover:text-brand-300">
            {item.player.fullName}
          </Link>
          <p className="truncate text-[11.5px] text-ink-500">
            {[item.player.position, l?.team, l?.league].filter(Boolean).join(" · ") || t("shortlistsPage.noLine")}
          </p>
        </div>
      </div>
      {l ? (
        <p className="mt-2 font-mono text-[11.5px] tabular-nums text-ink-300">
          {t("shortlistsPage.perGame", { ppg: l.ppg ?? "—", rpg: l.rpg ?? "—", apg: l.apg ?? "—" })}
          <span className="ml-2 text-ink-600">{l.season}</span>
        </p>
      ) : null}
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("shortlistsPage.notePlaceholder")}
            className={cn(fieldClass, "resize-none text-[13px]")}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-ink-400 hover:text-ink-100">
              ✕
            </button>
            <button
              type="button"
              onClick={() => {
                onPatch({ note: note.trim() || null })
                setEditing(false)
              }}
              className={cn(primaryButton, "px-3 py-1 text-[12px]")}
            >
              {t("workspace.follow.save")}
            </button>
          </div>
        </div>
      ) : item.note ? (
        <button
          type="button"
          disabled={!editable}
          onClick={() => setEditing(true)}
          className="mt-2 block w-full whitespace-pre-wrap rounded-lg bg-white/[0.03] px-2.5 py-2 text-left text-[12.5px] leading-snug text-ink-300"
        >
          {item.note}
        </button>
      ) : null}
      {editable ? (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <select
            value={item.status}
            onChange={(e) => onPatch({ status: e.target.value as Status })}
            aria-label={t("shortlistsPage.title")}
            className="rounded-lg border border-hairline bg-transparent px-2 py-1 text-[12px] text-ink-200"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-surface-2">
                {t(`workspace.statuses.${s}`)}
              </option>
            ))}
          </select>
          <span className="flex gap-3 text-[12px]">
            {!item.note && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className="text-ink-400 hover:text-ink-100">
                {t("shortlistsPage.addNote")}
              </button>
            ) : null}
            <button type="button" onClick={onRemove} className="text-ink-500 hover:text-red-300">
              {t("shortlistsPage.removePlayer")}
            </button>
          </span>
        </div>
      ) : null}
    </article>
  )
}

export function ShortlistBoard({ id }: { id: string }) {
  const t = useT()
  const router = useRouter()
  const [d, setD] = useState<Detail | null>(null)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState<Status>("watch")
  const [comment, setComment] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<Status | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/shortlists/${id}`, { cache: "no-store" })
    if (!r.ok) {
      setMissing(true)
      return
    }
    setD((await r.json()) as Detail)
  }, [id])

  useEffect(() => {
    void load() // eslint-disable-line react-hooks/set-state-in-effect
  }, [load])

  if (missing) return <p className="mt-10 text-sm text-ink-400">{t("shortlistsPage.notFound")}</p>
  if (!d) return <div className="gh-card mt-8 h-72 animate-pulse" />

  const editable = d.access !== "viewer"
  const json = { "Content-Type": "application/json" }

  async function patchItem(itemId: string, patch: { status?: Status; note?: string | null }) {
    setD((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, ...patch } as ShortlistItemView : i)) } : prev,
    )
    await fetch(`/api/shortlists/${id}/items`, { method: "PATCH", headers: json, body: JSON.stringify({ itemId, ...patch }) })
  }
  async function removeItem(itemId: string) {
    setD((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev))
    await fetch(`/api/shortlists/${id}/items?itemId=${itemId}`, { method: "DELETE" })
  }
  async function addPlayer(slug: string) {
    await fetch(`/api/shortlists/${id}/items`, { method: "POST", headers: json, body: JSON.stringify({ slug, status: tab }) })
    await load()
  }
  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    await fetch(`/api/shortlists/${id}/comments`, { method: "POST", headers: json, body: JSON.stringify({ body: comment.trim() }) })
    setComment("")
    await load()
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch(`/api/shortlists/${id}/members`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    setInviteMsg(r.ok ? t("shortlistsPage.inviteSent") : t("workspace.follow.error"))
    setInviteEmail("")
    await load()
  }
  async function removeMember(userId: string) {
    await fetch(`/api/shortlists/${id}/members?userId=${userId}`, { method: "DELETE" })
    if (userId === d!.me) router.push("/shortlists")
    else await load()
  }
  async function setRole(userId: string, role: "editor" | "viewer") {
    await fetch(`/api/shortlists/${id}/members`, { method: "PATCH", headers: json, body: JSON.stringify({ userId, role }) })
    await load()
  }
  async function rename() {
    const name = window.prompt(t("shortlistsPage.rename"), d!.name)?.trim()
    if (!name) return
    await fetch(`/api/shortlists/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ name }) })
    await load()
  }
  async function destroy() {
    if (!window.confirm(t("shortlistsPage.deleteConfirm"))) return
    await fetch(`/api/shortlists/${id}`, { method: "DELETE" })
    router.push("/shortlists")
  }

  const column = (s: Status) => d.items.filter((i) => i.status === s)

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/shortlists" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400 hover:text-brand-300">
          ← {t("shortlistsPage.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/shortlists/${id}/export`} className="inline-flex h-9 items-center rounded-lg border border-hairline px-3 text-xs font-semibold text-ink-200 hover:text-ink-50">
            {t("shortlistsPage.export")}
          </a>
          <a href={`/api/shortlists/${id}/export?excel=1`} className="inline-flex h-9 items-center rounded-lg border border-hairline px-3 text-xs font-semibold text-ink-200 hover:text-ink-50">
            {t("shortlistsPage.exportExcel")}
          </a>
          {editable ? <ShareButton kind="shortlist" refId={id} targetId={id} align="right" /> : null}
          {editable ? (
            <button type="button" onClick={rename} className="inline-flex h-9 items-center rounded-lg border border-hairline px-3 text-xs font-semibold text-ink-200 hover:text-ink-50">
              {t("shortlistsPage.rename")}
            </button>
          ) : null}
        </div>
      </div>

      <header>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-ink-50 sm:text-5xl">{d.name}</h1>
        {d.description ? <p className="mt-2 max-w-2xl text-sm text-ink-400">{d.description}</p> : null}
        {!editable ? <p className="mt-2 text-[12.5px] text-amber-300/90">{t("shortlistsPage.viewOnly")}</p> : null}
      </header>

      {editable ? (
        <div className="max-w-md">
          <PlayerPicker
            label={t("shortlistsPage.addPlayer")}
            placeholder={`${t("shortlistsPage.addPlayer")} — ${t("shortlistsPage.addPlayerPlaceholder")}`}
            onPick={(p) => void addPlayer(p.slug)}
          />
        </div>
      ) : null}

      {/* Phones: one column at a time behind tabs. */}
      <div role="tablist" className="flex gap-1 overflow-x-auto lg:hidden">
        {STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
              tab === s ? "border-brand-500/50 bg-brand-500/10 text-ink-50" : "border-hairline text-ink-400",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", ACCENT[s])} />
            {t(`workspace.statuses.${s}`)}
            <span className="font-mono text-[11px] text-ink-500">{column(s).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <section
            key={s}
            onDragOver={(e) => {
              if (!editable) return
              e.preventDefault()
              setDragOver(s)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              const itemId = e.dataTransfer.getData("text/plain")
              if (itemId) void patchItem(itemId, { status: s })
            }}
            className={cn(
              "rounded-3xl border p-2.5 transition-colors",
              dragOver === s ? "border-brand-500/60 bg-brand-500/[0.06]" : "border-hairline bg-white/[0.015]",
              tab === s ? "block" : "hidden lg:block",
            )}
          >
            <h2 className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
              <span className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-300">
                <span className={cn("h-1.5 w-1.5 rounded-full", ACCENT[s])} />
                {t(`workspace.statuses.${s}`)}
              </span>
              <span className="font-mono text-[11px] text-ink-500">{column(s).length}</span>
            </h2>
            <div className="space-y-2">
              {column(s).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-hairline px-3 py-6 text-center text-[12px] text-ink-600">
                  {t("shortlistsPage.emptyColumn")}
                </p>
              ) : (
                column(s).map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    editable={editable}
                    onPatch={(p) => void patchItem(item.id, p)}
                    onRemove={() => void removeItem(item.id)}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="gh-card p-4 sm:p-5">
          <h2 className="gh-eyebrow">{t("shortlistsPage.comments")}</h2>
          <form onSubmit={postComment} className="mt-3 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder={t("shortlistsPage.commentPlaceholder")} className={fieldClass} />
            <button type="submit" disabled={!comment.trim()} className={primaryButton}>
              {t("shortlistsPage.comment")}
            </button>
          </form>
          <ul className="mt-4 space-y-3">
            {d.comments.length === 0 ? <li className="text-[13px] text-ink-500">{t("shortlistsPage.noComments")}</li> : null}
            {d.comments.map((c) => (
              <li key={c.id} className="border-l-2 border-hairline pl-3">
                <p className="text-[12px] text-ink-500">
                  <span className="font-semibold text-ink-200">{c.author}</span> · {formatRelativeAgo(new Date(c.createdAt), t)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-100">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="gh-card h-fit p-4 sm:p-5">
          <h2 className="gh-eyebrow">{t("shortlistsPage.members")}</h2>
          <ul className="mt-3 space-y-2">
            {d.owner ? (
              <li className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate text-ink-100">
                  {d.owner.name}
                  {d.owner.id === d.me ? <span className="text-ink-500"> ({t("shortlistsPage.you")})</span> : null}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-300">{t("shortlistsPage.ownerRole")}</span>
              </li>
            ) : null}
            {d.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate text-ink-200">
                  {m.name}
                  {m.userId === d.me ? <span className="text-ink-500"> ({t("shortlistsPage.you")})</span> : null}
                  {m.email ? <span className="block truncate text-[11px] text-ink-600">{m.email}</span> : null}
                </span>
                {d.access === "owner" ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => void setRole(m.userId, e.target.value as "editor" | "viewer")}
                      className="rounded-md border border-hairline bg-transparent px-1.5 py-0.5 text-[11.5px] text-ink-300"
                    >
                      <option value="editor" className="bg-surface-2">{t("shortlistsPage.roleEditor")}</option>
                      <option value="viewer" className="bg-surface-2">{t("shortlistsPage.roleViewer")}</option>
                    </select>
                    <button type="button" onClick={() => void removeMember(m.userId)} className="text-[11.5px] text-ink-500 hover:text-red-300">
                      {t("shortlistsPage.remove")}
                    </button>
                  </span>
                ) : (
                  <span className="shrink-0 text-[11.5px] text-ink-500">
                    {m.role === "viewer" ? t("shortlistsPage.roleViewer") : t("shortlistsPage.roleEditor")}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {d.access === "owner" ? (
            <form onSubmit={invite} className="mt-4 space-y-2 border-t border-hairline pt-4">
              <label className="block">
                <span className="mb-1 block text-[11.5px] text-ink-400">{t("shortlistsPage.invite")}</span>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder={t("shortlistsPage.invitePlaceholder")} className={fieldClass} />
              </label>
              <div className="flex gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                  className="flex-1 rounded-lg border border-hairline bg-transparent px-2 text-[12.5px] text-ink-200"
                >
                  <option value="editor" className="bg-surface-2">{t("shortlistsPage.roleEditor")}</option>
                  <option value="viewer" className="bg-surface-2">{t("shortlistsPage.roleViewer")}</option>
                </select>
                <button type="submit" className={primaryButton}>
                  {t("shortlistsPage.inviteButton")}
                </button>
              </div>
              <p className="text-[11px] leading-snug text-ink-600">{inviteMsg ?? t("shortlistsPage.inviteHint")}</p>
            </form>
          ) : (
            <button type="button" onClick={() => void removeMember(d.me)} className="mt-4 text-[12px] text-ink-500 hover:text-red-300">
              {t("shortlistsPage.leave")}
            </button>
          )}
          {d.access === "owner" ? (
            <button type="button" onClick={destroy} className="mt-5 block text-[12px] text-ink-600 hover:text-red-300">
              {t("shortlistsPage.delete")}
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
