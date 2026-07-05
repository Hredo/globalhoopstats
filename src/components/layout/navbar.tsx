"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Logo } from "@/components/svg/logo"
import { SearchTrigger } from "@/components/players/search-trigger"
import { UserMenu } from "@/components/auth/user-menu"
import { MobileNav } from "@/components/layout/mobile-nav"

import { SITE } from "@/lib/site"
import { cn } from "@/components/ui/cn"
import { LEAGUE_FILTER_TREE } from "@/lib/league-groups"
import { useT } from "@/lib/i18n/provider"
import { LanguageSwitcher } from "@/components/layout/language-switcher"

const LINKS: {
  href: string
  labelKey: string
  leagues?: boolean
  pro?: boolean
}[] = [
  { href: "/players", labelKey: "nav.players", leagues: true },
  { href: "/teams", labelKey: "nav.teams", leagues: true },
  { href: "/coaches", labelKey: "nav.coaches" },
  { href: "/compare", labelKey: "nav.compare" },
  { href: "/leagues", labelKey: "nav.leagues" },
  { href: "/ai-advisor", labelKey: "nav.aiAdvisor", pro: true },
  { href: "/market/trade", labelKey: "nav.trade" },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Navbar() {
  const pathname = usePathname()
  const t = useT()
  const [scrolled, setScrolled] = useState(false)
  const progressRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Scroll progress hairline, updated outside React via rAF so it costs
  // nothing on re-render and needs no animation library.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const p = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p})`
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <header className="sticky top-0 z-50">
      {/* scroll progress — a solid signal line, like a shot-clock bar */}
      <div
        ref={progressRef}
        aria-hidden
        style={{ transform: "scaleX(0)" }}
        className="absolute inset-x-0 top-0 z-10 h-[2px] origin-left bg-brand-500"
      />
      <div
        className={cn(
          "border-b transition-[background-color,border-color,box-shadow] duration-300 ease-swift",
          scrolled ? "gh-glass border-hairline" : "border-transparent",
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2 text-ink-50 sm:gap-2.5"
            aria-label={`${SITE.name} — ${t("common.home")}`}
          >
            <Logo className="h-7 w-7 transition-transform duration-700 ease-spring group-hover:rotate-[18deg] sm:h-8 sm:w-8" />
            <span className="font-display text-[13px] font-bold tracking-[-0.02em] sm:text-base">
              globalhoopstats<span className="text-brand-500">.</span>
            </span>
          </Link>

          <nav
            className="hidden h-full items-center xl:flex"
            aria-label={t("nav.primary")}
          >
            <ul className="flex h-full items-stretch gap-0.5 text-sm font-medium text-ink-300">
              {LINKS.map((l) => (
                <NavItem
                  key={l.href}
                  href={l.href}
                  label={t(l.labelKey)}
                  pro={l.pro}
                  active={isActive(pathname, l.href)}
                  withLeagues={l.leagues}
                />
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <SearchTrigger />
            <UserMenu />
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  )
}

function NavItem({
  href,
  label,
  active,
  pro,
  withLeagues,
}: {
  href: string
  label: string
  active: boolean
  pro?: boolean
  withLeagues?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // Hover-opening is desktop-only: on touch screens the first tap must
  // navigate, never just reveal the dropdown (that forced double taps).
  const [canHover, setCanHover] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!itemRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  function enter() {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 120)
  }

  const hoverable = withLeagues && canHover

  return (
    <li
      ref={itemRef}
      className="relative flex h-full items-stretch"
      onMouseEnter={hoverable ? enter : undefined}
      onMouseLeave={hoverable ? leave : undefined}
      onFocus={hoverable ? enter : undefined}
      onBlur={hoverable ? leave : undefined}
    >
      <div
        className={cn(
          "relative flex items-center transition-colors duration-200",
          active && "text-ink-50",
        )}
      >
        {/* current-page tick — a solid bar registered to the header rule */}
        {active && (
          <span
            aria-hidden
            className="absolute inset-x-2 bottom-0 h-[2px] bg-brand-500"
          />
        )}
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 py-2 transition-colors duration-200",
            withLeagues ? "pl-2.5 pr-1 lg:pl-3" : "px-2.5 lg:px-3",
            !active && "hover:text-ink-50",
          )}
        >
          {label}
          {pro && (
            <span className="text-condensed rounded-sm border border-brand-500/40 bg-brand-500/10 px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-brand-300">
              {t("common.pro")}
            </span>
          )}
        </Link>
        {withLeagues && (
          <button
            type="button"
            aria-label={t("nav.browseByLeague", { label: label.toLowerCase() })}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex items-center self-stretch pl-0.5 pr-2.5 transition-colors duration-200 lg:pr-3",
              !active && "hover:text-ink-50",
            )}
          >
            <svg
              aria-hidden
              className={cn(
                "h-3 w-3 transition-transform duration-300 ease-fluid",
                open && "rotate-180",
              )}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6 9 6 6 6-6"
              />
            </svg>
          </button>
        )}
      </div>

      {withLeagues && (
        <div
          role="menu"
          className={cn(
            "absolute left-1/2 top-full z-50 mt-1 w-56 origin-top -translate-x-1/2 rounded-lg border border-hairline bg-surface-2/95 p-1.5 shadow-[var(--shadow-court)] backdrop-blur-xl transition-all duration-200 ease-swift",
            open
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0",
          )}
        >
          <p className="text-condensed px-2.5 pb-1.5 pt-1 text-[10px] tracking-[0.18em] text-ink-500">
            {t("common.byLeague")}
          </p>
          <Link
            href={href}
            role="menuitem"
            tabIndex={open ? undefined : -1}
            onClick={() => setOpen(false)}
            className="block rounded-md px-2.5 py-2 text-[13px] font-medium text-ink-200 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink-50"
          >
            {t("common.allLeagues")}
          </Link>
          {LEAGUE_FILTER_TREE.map((node) => (
            <div key={node.slug}>
              <Link
                href={`${href}?league=${node.slug}`}
                role="menuitem"
                tabIndex={open ? undefined : -1}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium text-ink-200 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink-50"
              >
                <span aria-hidden className="h-1.5 w-1.5 bg-brand-500/80" />
                {node.label}
              </Link>
              {node.children?.map((child) => (
                <Link
                  key={child.slug}
                  href={`${href}?league=${child.slug}`}
                  role="menuitem"
                  tabIndex={open ? undefined : -1}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md py-1.5 pl-7 pr-2.5 text-[12px] font-medium text-ink-300 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink-50"
                >
                  <span aria-hidden className="h-1 w-1 bg-brand-500/60" />
                  {child.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
