"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { cn } from "@/components/ui/cn"
import { useLocale, useT } from "@/lib/i18n/provider"
import { formatRelativeAgo } from "@/lib/format-time"
import { fieldClass, primaryButton } from "@/components/workspace/popover"
import { SmartImage } from "@/components/ui/smart-image"
import { PersonAvatar } from "@/components/ui/person-avatar"

type Thresholds = Partial<Record<"ppg" | "rpg" | "apg" | "per", number>>
type Snapshot =
  | { kind: "player"; teamName: string | null; season: string | null; gamesPlayed: number; ppg: number | null; rpg: number | null; apg: number | null }
  | { kind: "team"; season: string | null; playerIds: string[]; headCoach: string | null }
type Follow = {
  id: string
  kind: "player" | "team"
  name: string
  href: string
  imageUrl: string | null
  thresholds: Thresholds | null
  snapshot: Snapshot | null
}
type Note = { id: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string }
type PushState = { enabled: boolean; publicKey: string | null; devices: number; emailAlerts: boolean }

const KEYS = ["ppg", "rpg", "apg", "per"] as const

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-50",
        on ? "border-brand-500 bg-brand-500" : "border-hairline bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-ink-50 shadow transition-transform duration-200 ease-fluid",
          on ? "translate-x-[22px] bg-ink-950" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

function ThresholdEditor({ follow, onSaved }: { follow: Follow; onSaved: (t: Thresholds | null) => void }) {
  const t = useT()
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(KEYS.map((k) => [k, follow.thresholds?.[k]?.toString() ?? ""])),
  )
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const thresholds = Object.fromEntries(
          KEYS.filter((k) => draft[k]?.trim()).map((k) => [k, Number(draft[k]!.replace(",", "."))]),
        )
        const r = await fetch("/api/follows", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: follow.id, thresholds }),
        }).catch(() => null)
        const d = r ? ((await r.json()) as { thresholds?: Thresholds | null }) : null
        onSaved(d?.thresholds ?? null)
        setBusy(false)
      }}
    >
      {KEYS.map((k) => (
        <label key={k}>
          <span className="mb-1 block text-[11px] text-ink-500">{t(`workspace.follow.${k}`)}</span>
          <input
            inputMode="decimal"
            value={draft[k] ?? ""}
            placeholder="—"
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
            className={fieldClass}
          />
        </label>
      ))}
      <button type="submit" disabled={busy} className={cn(primaryButton, "col-span-2 sm:col-span-1")}>
        {t("workspace.follow.save")}
      </button>
    </form>
  )
}

export function FollowingClient() {
  const t = useT()
  const locale = useLocale()
  const [follows, setFollows] = useState<Follow[] | null>(null)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [push, setPush] = useState<PushState | null>(null)
  const [deviceOn, setDeviceOn] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [f, n, p] = await Promise.all([
      fetch("/api/follows", { cache: "no-store" }).then((r) => r.json() as Promise<{ follows: Follow[] }>),
      fetch("/api/notifications?limit=30", { cache: "no-store" }).then((r) => r.json() as Promise<{ items: Note[] }>),
      fetch("/api/push", { cache: "no-store" }).then((r) => r.json() as Promise<PushState>),
    ])
    setFollows(f.follows)
    setNotes(n.items)
    setPush(p)
  }, [])

  useEffect(() => {
    void load() // eslint-disable-line react-hooks/set-state-in-effect
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/serwist/sw.js").then(async (reg) => {
        setDeviceOn(!!(await reg?.pushManager.getSubscription()))
      })
    }
  }, [load])

  async function setEmail(on: boolean) {
    setPush((p) => (p ? { ...p, emailAlerts: on } : p))
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailAlerts: on }),
    })
  }

  async function setDevice(on: boolean) {
    setPushMsg(null)
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushMsg(t("followingPage.pushUnavailable"))
      return
    }
    if (!push?.enabled || !push.publicKey) {
      setPushMsg(t("followingPage.pushNotConfigured"))
      return
    }
    const reg = await navigator.serviceWorker.register("/serwist/sw.js")
    await navigator.serviceWorker.ready
    if (!on) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setDeviceOn(false)
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      setPushMsg(t("followingPage.pushDenied"))
      return
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(push.publicKey),
    })
    const r = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
    setDeviceOn(r.ok)
  }

  async function unfollow(id: string) {
    setFollows((list) => list?.filter((f) => f.id !== id) ?? list)
    await fetch(`/api/follows?id=${id}`, { method: "DELETE" })
  }

  const describe = (f: Follow): string | null => {
    const s = f.snapshot
    if (!s) return null
    if (s.kind === "player") {
      const line = [s.teamName, s.season, s.ppg != null ? `${s.ppg} pts` : null].filter(Boolean).join(" · ")
      return line || null
    }
    return [s.season, s.headCoach].filter(Boolean).join(" · ") || null
  }

  const group = (kind: Follow["kind"]) => (follows ?? []).filter((f) => f.kind === kind)

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {follows === null ? (
          <div className="gh-card h-48 animate-pulse" />
        ) : follows.length === 0 ? (
          <div className="gh-card p-6 text-sm leading-relaxed text-ink-300">{t("followingPage.empty")}</div>
        ) : (
          (["player", "team"] as const).map((kind) =>
            group(kind).length ? (
              <section key={kind} className="gh-card p-4 sm:p-5">
                <h2 className="gh-eyebrow">{t(kind === "player" ? "followingPage.players" : "followingPage.teams")}</h2>
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {group(kind).map((f) => (
                    <li key={f.id} className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-court-800 ring-1 ring-hairline">
                          <SmartImage src={f.imageUrl} alt="" fit={kind === "team" ? "contain" : "cover"} fallback={<PersonAvatar name={f.name} />} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={f.href} className="block truncate font-semibold text-ink-50 hover:text-brand-300">
                            {f.name}
                          </Link>
                          <p className="truncate text-[12px] text-ink-500">
                            {describe(f) ? t("followingPage.lastSeen", { line: describe(f)! }) : null}
                          </p>
                        </div>
                        {kind === "player" ? (
                          <button
                            type="button"
                            onClick={() => setEditing(editing === f.id ? null : f.id)}
                            aria-expanded={editing === f.id}
                            className="hidden rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-ink-300 hover:text-ink-50 sm:block"
                          >
                            {f.thresholds
                              ? Object.entries(f.thresholds).map(([k, v]) => `${k.toUpperCase()} ≥ ${v}`).join(" · ")
                              : t("followingPage.thresholds")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => unfollow(f.id)}
                          className="rounded-lg px-2 py-1.5 text-[12px] text-ink-500 hover:text-red-300"
                        >
                          {t("followingPage.unfollow")}
                        </button>
                      </div>
                      {kind === "player" ? (
                        <button
                          type="button"
                          onClick={() => setEditing(editing === f.id ? null : f.id)}
                          className="mt-2 text-[12px] text-brand-300 sm:hidden"
                        >
                          {t("followingPage.thresholds")}
                        </button>
                      ) : null}
                      {editing === f.id ? (
                        <ThresholdEditor
                          follow={f}
                          onSaved={(th) => {
                            setFollows((list) => list?.map((x) => (x.id === f.id ? { ...x, thresholds: th } : x)) ?? list)
                            setEditing(null)
                          }}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )
        )}

        <section className="gh-card p-4 sm:p-5">
          <h2 className="gh-eyebrow">{t("followingPage.recent")}</h2>
          <ul className="mt-3 space-y-1">
            {notes && notes.length === 0 ? <li className="py-2 text-sm text-ink-400">{t("followingPage.noRecent")}</li> : null}
            {(notes ?? []).map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? "#"} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.03]">
                  <span aria-hidden className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.readAt ? "bg-white/15" : "bg-brand-500")} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-ink-100">{n.title}</span>
                    {n.body ? <span className="block text-[12.5px] text-ink-400">{n.body}</span> : null}
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-600">
                      {formatRelativeAgo(new Date(n.createdAt), t)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="gh-card h-fit space-y-5 p-5 lg:sticky lg:top-24">
        <h2 className="gh-eyebrow">{t("followingPage.channels")}</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-100">{t("followingPage.inApp")}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">{t("followingPage.inAppHint")}</p>
          </div>
          <Toggle on onChange={() => {}} label={t("followingPage.inApp")} disabled />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-100">{t("followingPage.email")}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">{t("followingPage.emailHint")}</p>
          </div>
          <Toggle on={push?.emailAlerts ?? true} onChange={setEmail} label={t("followingPage.email")} disabled={!push} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-100">{t("followingPage.push")}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">{t("followingPage.pushHint")}</p>
          </div>
          <Toggle on={deviceOn} onChange={(v) => void setDevice(v)} label={t("followingPage.push")} disabled={!push} />
        </div>
        {pushMsg ? <p className="text-[12px] text-amber-300/90">{pushMsg}</p> : null}
        <p className="border-t border-hairline pt-4 text-[11.5px] text-ink-600" lang={locale}>
          {t("followingPage.lede")}
        </p>
      </aside>
    </div>
  )
}
