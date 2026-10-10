"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Logo } from "@/components/svg/logo"
import { UserMenu } from "@/components/auth/user-menu"
import { MobileNav } from "@/components/layout/mobile-nav"
import { NavPanel } from "@/components/layout/nav-panel"
import { NotificationBell } from "@/components/layout/notification-bell"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { NavIcon } from "@/components/layout/nav-icons"
import { SITE } from "@/lib/site"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import { activeGroup, NAV_GROUPS, type NavGroup } from "@/lib/nav/sections"

type GroupId = NavGroup["id"]

/**
 * Three groups instead of eight links: Explore (the catalogue), Analyze (the
 * tools that read it) and Scouting (the user's own work). Each opens a panel
 * with one line of context per destination, so the bar stays short however
 * many pages the site grows — new pages go into src/lib/nav/sections.ts.
 */
export function Navbar() {
  const pathname = usePathname()
  const t = useT()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState<GroupId | null>(null)
  const [canHover, setCanHover] = useState(false)
  const progressRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const triggerRefs = useRef<Partial<Record<GroupId, HTMLButtonElement | null>>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // After an explicit close (Escape, or clicking the open trigger) hover must
  // not reopen the panel until the pointer has left the trigger: the bar's
  // border changes on close, which re-fires mouseenter under a still pointer.
  const hoverLock = useRef(false)
  const current = activeGroup(pathname)
  // The panel keeps showing the last group while it collapses, so closing is a
  // smooth fold instead of the content vanishing and the height snapping shut.
  const [shown, setShown] = useState<GroupId | null>(null)
  useEffect(() => {
    if (open) setShown(open) // eslint-disable-line react-hooks/set-state-in-effect
  }, [open])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Scroll progress hairline, updated outside React via rAF.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const p = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`
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

  // Hover-to-open only with a real pointer; on touch the first tap must act.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    setCanHover(mq.matches) // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = () => setCanHover(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    setOpen(null) // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname])

  const close = useCallback((refocus = false) => {
    hoverLock.current = true
    if (timer.current) clearTimeout(timer.current)
    setOpen((prev) => {
      if (refocus && prev) triggerRefs.current[prev]?.focus()
      return null
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  const schedule = (next: GroupId | null, delay: number) => {
    if (next && hoverLock.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), delay)
  }

  function openSearch() {
    document.dispatchEvent(new CustomEvent("open-search-palette"))
  }

  return (
    <>
      <header className="sticky top-0 z-50">
        <div
          ref={progressRef}
          aria-hidden
          style={{ transform: "scaleX(0)" }}
          className="absolute inset-x-0 top-0 z-10 h-px origin-left bg-gradient-to-r from-brand-500 via-ember-400 to-brand-600"
        />
        <div className="mx-auto max-w-[1600px] px-2 sm:px-6 lg:px-8">
          <div
            ref={barRef}
            onMouseLeave={canHover ? () => schedule(null, 160) : undefined}
            className={cn(
              "relative mt-2 rounded-[22px] transition-[background-color,box-shadow,border-color,padding] duration-500 ease-fluid sm:mt-3",
              scrolled || open || shown
                ? "gh-glass shadow-[var(--shadow-court)]"
                : "border border-transparent",
            )}
          >
            <div className="flex h-12 items-center justify-between gap-2 px-2 sm:h-14 sm:px-3">
              <Link
                href="/"
                className="group flex shrink-0 items-center gap-2 text-ink-50 sm:gap-2.5"
                aria-label={`${SITE.name} — ${t("common.home")}`}
              >
                <Logo className="h-7 w-7 transition-transform duration-700 ease-fluid group-hover:rotate-[18deg] sm:h-8 sm:w-8" />
                <span className="font-display text-[14px] font-bold tracking-[-0.02em] sm:text-base">
                  globalhoopstats<span className="text-brand-500">.</span>
                </span>
              </Link>

              <nav aria-label={t("nav.primary")} className="hidden lg:block">
                <ul className="flex items-center gap-1">
                  {NAV_GROUPS.map((g) => {
                    const isOpen = open === g.id
                    const isCurrent = current === g.id
                    return (
                      <li key={g.id}>
                        <button
                          ref={(el) => {
                            triggerRefs.current[g.id] = el
                          }}
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls="nav-panel"
                          onClick={() => {
                            if (isOpen) close()
                            else setOpen(g.id)
                          }}
                          onMouseEnter={canHover ? () => schedule(g.id, open ? 0 : 90) : undefined}
                          onMouseLeave={() => {
                            hoverLock.current = false
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault()
                              setOpen(g.id)
                              requestAnimationFrame(() =>
                                document.querySelector<HTMLAnchorElement>("#nav-panel a")?.focus(),
                              )
                            }
                          }}
                          className={cn(
                            "group relative flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium transition-colors duration-300",
                            isOpen || isCurrent ? "text-ink-50" : "text-ink-300 hover:text-ink-50",
                          )}
                        >
                          {t(`nav.groups.${g.id}`)}
                          <NavIcon
                            name="chevron"
                            className={cn(
                              "h-3 w-3 opacity-60 transition-transform duration-300 ease-fluid",
                              isOpen && "rotate-180",
                            )}
                          />
                          {/* A free-throw line under the section you are in. */}
                          <span
                            aria-hidden
                            className={cn(
                              "absolute inset-x-3.5 -bottom-0.5 h-[2px] origin-center rounded-full bg-brand-500 transition-transform duration-500 ease-fluid",
                              isCurrent ? "scale-x-100" : "scale-x-0",
                            )}
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={openSearch}
                  title="Ctrl+K"
                  aria-label={t("nav.searchHint")}
                  className="hidden h-9 items-center gap-2 rounded-full border border-hairline bg-white/[0.04] pl-3 pr-1.5 text-[12.5px] text-ink-400 transition-colors duration-300 hover:border-brand-400/40 hover:text-ink-100 lg:inline-flex"
                >
                  <NavIcon name="search" className="h-4 w-4" />
                  <span className="pr-3">{t("nav.searchHint")}</span>
                  <kbd className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] text-ink-500">
                    ⌘K
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label={t("nav.searchHint")}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink-300 transition-colors hover:text-ink-50 lg:hidden"
                >
                  <NavIcon name="search" className="h-[18px] w-[18px]" />
                </button>
                <NotificationBell />
                <UserMenu />
                <div className="hidden sm:block">
                  <LanguageSwitcher />
                </div>
                <MobileNav />
              </div>
            </div>

            <div
              id="nav-panel"
              onMouseEnter={canHover ? () => schedule(open, 0) : undefined}
              aria-hidden={!open}
              inert={!open}
              // Floats over the page (absolute) — it must never push the content
              // down — and unfolds/folds its height plus a short slide.
              className={cn(
                "absolute inset-x-0 top-full z-10 hidden pt-2 lg:block",
                !open && "pointer-events-none",
              )}
            >
              <div
                className={cn(
                  // Animated wrapper only: .gh-glass declares its own `transition`, which
                  // would override this one, so the glass lives on the child.
                  "grid overflow-hidden rounded-[22px] shadow-[var(--shadow-court)] transition-[grid-template-rows,opacity,transform] duration-[380ms] ease-fluid",
                  open ? "translate-y-0 grid-rows-[1fr] opacity-100" : "-translate-y-1.5 grid-rows-[0fr] opacity-0",
                )}
                onTransitionEnd={(e) => {
                  if (e.target === e.currentTarget && e.propertyName === "opacity" && !open) setShown(null)
                }}
              >
              <div className="min-h-0">
                <div className="gh-glass gh-glass-solid rounded-[22px]">
                {shown ? (
                  <NavPanel
                    group={NAV_GROUPS.find((g) => g.id === shown)!}
                    pathname={pathname}
                    onNavigate={() => setOpen(null)}
                  />
                ) : null}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
