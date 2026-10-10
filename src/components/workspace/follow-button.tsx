"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { NavIcon } from "@/components/layout/nav-icons"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import { useSession } from "@/lib/auth/use-session"
import {
  ActionPopover,
  actionButton,
  actionIdle,
  actionOn,
  fieldClass,
  primaryButton,
} from "@/components/workspace/popover"

type Thresholds = Partial<Record<"ppg" | "rpg" | "apg" | "per", number>>
const KEYS = ["ppg", "rpg", "apg", "per"] as const

export function FollowButton({ kind, slug }: { kind: "player" | "team"; slug: string }) {
  const t = useT()
  const pathname = usePathname()
  const { user, status } = useSession()
  const [state, setState] = useState<{ id: string | null; thresholds: Thresholds | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let alive = true
    fetch(`/api/follows?kind=${kind}&slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { id: string | null; thresholds: Thresholds | null } | null) => {
        if (!alive || !d) return
        setState({ id: d.id, thresholds: d.thresholds })
        setDraft(Object.fromEntries(KEYS.map((k) => [k, d.thresholds?.[k]?.toString() ?? ""])))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user, kind, slug])

  if (status === "loading") return <span className={cn(actionButton, actionIdle, "w-24 animate-pulse")} />
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cn(actionButton, actionIdle)}>
        <NavIcon name="following" className="h-3.5 w-3.5" />
        {t("workspace.follow.signIn")}
      </Link>
    )
  }

  const following = !!state?.id

  async function toggle() {
    setBusy(true)
    try {
      if (following) {
        await fetch(`/api/follows?id=${state!.id}`, { method: "DELETE" })
        setState({ id: null, thresholds: null })
      } else {
        const r = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, slug }),
        })
        const d = (await r.json()) as { id?: string }
        if (d.id) setState({ id: d.id, thresholds: null })
      }
    } finally {
      setBusy(false)
    }
  }

  async function saveThresholds() {
    if (!state?.id) return
    setBusy(true)
    const thresholds = Object.fromEntries(
      KEYS.filter((k) => draft[k]?.trim()).map((k) => [k, Number(draft[k]!.replace(",", "."))]),
    )
    try {
      const r = await fetch("/api/follows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: state.id, thresholds }),
      })
      const d = (await r.json()) as { thresholds?: Thresholds | null }
      setState({ ...state, thresholds: d.thresholds ?? null })
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } finally {
      setBusy(false)
    }
  }

  if (kind === "team" || !following) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={cn(actionButton, following ? actionOn : actionIdle)}
        title={kind === "team" ? t("workspace.follow.teamHint") : t("workspace.follow.playerHint")}
      >
        <NavIcon name="following" className={cn("h-3.5 w-3.5", following && "fill-current")} />
        {following ? t("workspace.follow.following") : t("workspace.follow.follow")}
      </button>
    )
  }

  return (
    <ActionPopover
      label={t("workspace.follow.thresholdsTitle")}
      trigger={({ toggle: open }) => (
        <button type="button" onClick={open} aria-pressed className={cn(actionButton, actionOn)}>
          <NavIcon name="following" className="h-3.5 w-3.5 fill-current" />
          {t("workspace.follow.following")}
          <NavIcon name="chevron" className="h-3 w-3 opacity-70" />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-ink-400">{t("workspace.follow.playerHint")}</p>
          <p className="gh-eyebrow">{t("workspace.follow.thresholdsTitle")}</p>
          <div className="grid grid-cols-2 gap-2">
            {KEYS.map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-[11.5px] text-ink-400">{t(`workspace.follow.${k}`)}</span>
                <input
                  inputMode="decimal"
                  value={draft[k] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                  className={fieldClass}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                await toggle()
                close()
              }}
              className="text-[12.5px] font-medium text-ink-400 hover:text-red-300"
            >
              {t("followingPage.unfollow")}
            </button>
            <button type="button" onClick={saveThresholds} disabled={busy} className={primaryButton}>
              {saved ? t("workspace.follow.saved") : t("workspace.follow.save")}
            </button>
          </div>
        </div>
      )}
    </ActionPopover>
  )
}
