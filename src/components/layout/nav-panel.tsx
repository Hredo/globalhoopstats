"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { NavIcon } from "@/components/layout/nav-icons"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import { LEAGUE_FILTER_TREE } from "@/lib/league-groups"
import { isActivePath, type NavGroup, type NavItem } from "@/lib/nav/sections"
import { useSession } from "@/lib/auth/use-session"

export function NavBadge({ badge }: { badge: NonNullable<NavItem["badge"]> }) {
  const t = useT()
  const label = badge === "pro" ? t("common.pro") : badge === "beta" ? "Beta" : t("common.new")
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em]",
        badge === "pro" && "border-brand-500/40 bg-brand-500/10 text-brand-300",
        badge === "beta" && "border-amber-400/50 bg-amber-400/10 text-amber-300",
        badge === "new" && "border-positive/40 bg-positive/10 text-positive",
      )}
    >
      {label}
    </span>
  )
}

/** One destination: icon, name, badge and the line that says what it is for. */
export function NavEntry({
  item,
  active,
  onNavigate,
  index,
  compact = false,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
  index?: number
  /** Icon + name only: the phone sheet, where everything must fit one screen. */
  compact?: boolean
}) {
  const t = useT()
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex gap-3 rounded-2xl transition-colors duration-200",
        compact ? "items-center p-2.5" : "items-start p-3",
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.04] focus-visible:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors duration-200",
          active
            ? "border-brand-500/50 bg-brand-500/15 text-brand-300"
            : "border-hairline bg-white/[0.03] text-ink-300 group-hover:border-brand-500/40 group-hover:text-brand-300",
        )}
      >
        <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          {index != null ? (
            <span className="font-mono text-[10px] tabular-nums text-brand-400/70">
              {String(index + 1).padStart(2, "0")}
            </span>
          ) : null}
          <span className={cn("text-[14px] font-semibold", active ? "text-ink-50" : "text-ink-100")}>
            {t(`nav.items.${item.key}.label`)}
          </span>
          {item.badge ? <NavBadge badge={item.badge} /> : null}
        </span>
        {compact ? null : (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-400">
            {t(`nav.items.${item.key}.desc`)}
          </span>
        )}
      </span>
    </Link>
  )
}

export function LeagueChips({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEAGUE_FILTER_TREE.flatMap((n) => [n, ...(n.children ?? [])]).map((n) => (
        <Link
          key={n.slug}
          href={`/players?league=${n.slug}`}
          onClick={onNavigate}
          className="rounded-full border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-300 transition-colors duration-200 hover:border-brand-400/50 hover:text-ink-50"
        >
          {n.label}
        </Link>
      ))}
    </div>
  )
}

type ListSummary = { id: string; name: string; items: number }

function useMyShortlists(enabled: boolean) {
  const [lists, setLists] = useState<ListSummary[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetch("/api/shortlists", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { shortlists: [] }))
      .then((d: { shortlists: ListSummary[] }) => alive && setLists(d.shortlists.slice(0, 4)))
      .catch(() => alive && setLists([]))
    return () => {
      alive = false
    }
  }, [enabled])
  return lists
}

function Aside({ group, onNavigate }: { group: NavGroup["id"]; onNavigate: () => void }) {
  const t = useT()
  const { user, status } = useSession()
  const lists = useMyShortlists(group === "workspace" && !!user)

  if (group === "explore") {
    return (
      <>
        <p className="gh-eyebrow">{t("nav.panel.leaguesTitle")}</p>
        <div className="mt-3">
          <LeagueChips onNavigate={onNavigate} />
        </div>
      </>
    )
  }
  if (group === "analyze") {
    return (
      <>
        <p className="gh-eyebrow">{t("nav.panel.analyzeTitle")}</p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-300">{t("nav.panel.analyzeTip")}</p>
      </>
    )
  }
  if (status !== "ready") return <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
  if (!user) {
    return (
      <>
        <p className="text-[12.5px] leading-relaxed text-ink-300">{t("nav.panel.workspaceSignedOut")}</p>
        <Link
          href="/login?next=/shortlists"
          onClick={onNavigate}
          className="mt-3 inline-flex rounded-full bg-brand-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-950 transition-colors hover:bg-brand-400"
        >
          {t("nav.panel.signIn")}
        </Link>
      </>
    )
  }
  return (
    <>
      <p className="gh-eyebrow">{t("nav.panel.workspaceTitle")}</p>
      <ul className="mt-2 space-y-0.5">
        {lists === null ? (
          <li className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : lists.length === 0 ? (
          <li className="py-1 text-[12.5px] text-ink-400">
            {t("nav.panel.workspaceEmpty")}{" "}
            <Link href="/shortlists" onClick={onNavigate} className="font-semibold text-brand-300 hover:text-brand-200">
              {t("nav.panel.workspaceCreate")}
            </Link>
          </li>
        ) : (
          lists.map((l) => (
            <li key={l.id}>
              <Link
                href={`/shortlists/${l.id}`}
                onClick={onNavigate}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-200 transition-colors hover:bg-white/[0.04] hover:text-ink-50"
              >
                <span className="truncate">{l.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-ink-500">{l.items}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </>
  )
}

export function NavPanel({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup
  pathname: string
  onNavigate: () => void
}) {
  return (
    <div
      key={group.id}
      className="mx-auto grid max-w-[1040px] animate-overlay-in grid-cols-[1fr_260px] gap-2 p-3"
    >
      <div className="grid grid-cols-2 gap-1">
        {group.items.map((item, i) => (
          <NavEntry
            key={item.href}
            item={item}
            index={i}
            active={isActivePath(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      <aside className="rounded-2xl border border-hairline bg-white/[0.02] p-4">
        <Aside group={group.id} onNavigate={onNavigate} />
      </aside>
    </div>
  )
}
