"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

type MeResponse = {
  user: {
    id: string
    email: string
    name: string
    plan: string
    role: string
  } | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

function planBadge(
  plan: string,
  role: string,
): {
  label: string
  color: string
} {
  if (role === "admin")
    return {
      label: "Admin",
      color: "border-brand-400/50 bg-brand-500/15 text-brand-200",
    }
  if (plan === "pro")
    return {
      label: "Pro",
      color: "border-positive/50 bg-positive/10 text-positive",
    }
  return {
    label: "Free",
    color: "border-hairline bg-white/[0.04] text-ink-300",
  }
}

export function UserMenu() {
  const [me, setMe] = useState<MeResponse["user"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      const data = (await res.json()) as MeResponse
      setMe(data.user)
    } catch {
      // keep the previous state on a transient network error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMe()
    // Re-check the session when auth changes elsewhere (login / register /
    // logout in this tab, or another tab) without a full page reload.
    const onAuthChanged = () => refreshMe()
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshMe()
    }
    window.addEventListener("auth:changed", onAuthChanged)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("auth:changed", onAuthChanged)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refreshMe])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) {
        return
      }
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  if (loading) {
    return (
      <div className="hidden h-9 w-24 animate-pulse rounded-md bg-white/[0.04] md:block" />
    )
  }

  if (!me) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link
          href="/login"
          className="hidden h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-200 transition-colors duration-200 hover:bg-white/[0.06] hover:text-ink-50 sm:inline-flex"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="gh-sheen group/cta inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-400 to-ember-500 pl-4 pr-3 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition-all duration-300 ease-swift hover:shadow-[var(--shadow-brand-glow-lg)] active:scale-[0.98]"
        >
          Get started
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-950/15 transition-transform duration-300 ease-swift group-hover/cta:translate-x-0.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </Link>
      </div>
    )
  }

  const badge = planBadge(me.plan, me.role)

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignore
    }
    setMe(null)
    setOpen(false)
    // Hard navigation guarantees the cleared cookie is honored and all
    // client state (including this menu) is rebuilt as a signed-out session.
    window.location.assign("/")
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 pr-3 transition hover:border-white/25 hover:bg-white/[0.08]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-ink-950">
          {initials(me.name)}
        </span>
        <span className="hidden text-xs font-medium text-ink-100 sm:inline">
          {me.name.split(" ")[0]}
        </span>
        <span
          className={`hidden rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest sm:inline-flex ${badge.color}`}
        >
          {badge.label}
        </span>
        <svg
          className={`h-3 w-3 text-ink-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right animate-menu-in overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur-md"
          role="menu"
        >
          <div className="bg-gradient-to-b from-brand-500/[0.06] to-transparent px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-ink-950 shadow-lg shadow-brand-500/20">
                {initials(me.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-50">
                  {me.name}
                </p>
                <p className="truncate text-xs text-ink-400">{me.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${badge.color}`}
              >
                {badge.label}
              </span>
              {me.plan === "free" && me.role !== "admin" ? (
                <Link
                  href="/account/subscription"
                  className="text-[11px] font-medium text-brand-300 transition hover:text-brand-200"
                  onClick={() => setOpen(false)}
                >
                  Upgrade →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          <div className="p-1.5">
            <MenuLink
              href="/account"
              icon={<IconPath d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />}
              onSelect={() => setOpen(false)}
            >
              Account settings
            </MenuLink>
            <MenuLink
              href="/account/ai-keys"
              icon={<IconPath d="M14 7a4 4 0 11-3.8 5.2L4 18v3h3v-2h2v-2h2l1.2-1.2A4 4 0 0114 7zm2.5 2.5h.01" />}
              onSelect={() => setOpen(false)}
            >
              AI &amp; keys
            </MenuLink>
            <MenuLink
              href="/account/subscription"
              icon={<IconPath d="M3 7h18M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l2-3h14l2 3M7 14h4" />}
              onSelect={() => setOpen(false)}
            >
              Subscription
            </MenuLink>
          </div>
          {me.role === "admin" ? (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="p-1.5">
                <MenuLink
                  href="/admin"
                  icon={<IconPath d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />}
                  onSelect={() => setOpen(false)}
                >
                  Admin
                </MenuLink>
              </div>
            </>
          ) : null}
          <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          <div className="p-1.5">
            <MenuLink
              href="/ai-advisor"
              icon={<IconPath d="M9.5 2A2.5 2.5 0 0112 4.5v11a2.5 2.5 0 01-5 0v-11A2.5 2.5 0 019.5 2zm0 0v5m5 8a4 4 0 01-8 0m5-12a2 2 0 00-2 2" />}
              onSelect={() => setOpen(false)}
            >
              AI Advisor
            </MenuLink>
            <MenuLink
              href="/compare"
              icon={<IconPath d="M4 20V4m4 16v-8a2 2 0 012-2h4a2 2 0 012 2v8m4 0V8a2 2 0 00-2-2h-4a2 2 0 00-2 2v12" />}
              onSelect={() => setOpen(false)}
            >
              Compare
            </MenuLink>
            <MenuLink
              href="/ai-setup"
              icon={<IconPath d="M11.4 3.4a1 1 0 011.2 0l1.3 1a4 4 0 002.7.4l1.6-.3a1 1 0 011 .6l.6 1.5a4 4 0 001.4 2.2l1.1 1.1a1 1 0 010 1.4l-1.1 1.1a4 4 0 00-1.4 2.2l-.6 1.5a1 1 0 01-1 .6l-1.6-.3a4 4 0 00-2.7.4l-1.3 1a1 1 0 01-1.2 0l-1.3-1a4 4 0 00-2.7-.4l-1.6.3a1 1 0 01-1-.6l-.6-1.5a4 4 0 00-1.4-2.2L2 12a1 1 0 010-1.4l1.1-1.1a4 4 0 001.4-2.2l.6-1.5a1 1 0 011-.6l1.6.3a4 4 0 002.7-.4l1.3-1zM9 12a3 3 0 106 0 3 3 0 00-6 0z" />}
              onSelect={() => setOpen(false)}
            >
              Connect your AI
            </MenuLink>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          <div className="p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <span className="flex h-4 w-4 items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M15 12H3m0 0l4-4m-4 4l4 4m11-9V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h9a2 2 0 002-2v-2" />
                </svg>
              </span>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function IconPath({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

function MenuLink({
  href,
  icon,
  children,
  onSelect,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  onSelect: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-200 transition hover:bg-white/[0.05] hover:text-ink-50"
    >
      <span className="flex h-4 w-4 items-center justify-center text-ink-500 transition group-hover:text-brand-400">
        {icon}
      </span>
      {children}
    </Link>
  )
}

export default UserMenu
