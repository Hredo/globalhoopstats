"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { LEAGUE_FILTER_TREE } from "@/lib/league-groups"
import { useT } from "@/lib/i18n/provider"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { CourtMarkings } from "@/components/ui/court-markings"

const FEB_CHILDREN = LEAGUE_FILTER_TREE.find((n) => n.children)?.children ?? []

const PRIMARY_LINKS = [
  { href: "/players", labelKey: "nav.players" },
  { href: "/teams", labelKey: "nav.teams" },
  { href: "/coaches", labelKey: "nav.coaches" },
  { href: "/compare", labelKey: "nav.compare" },
  { href: "/leagues", labelKey: "nav.leagues" },
  { href: "/ai-advisor", labelKey: "nav.aiAdvisor" },
  { href: "/market/trade", labelKey: "nav.trade" },
  { href: "/playbook", labelKey: "nav.playbook" },
] as const

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useT()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="relative z-[110] inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/[0.05] text-ink-100 transition-colors duration-300 hover:border-brand-400/40 xl:hidden"
      >
        <span className="relative block h-3 w-5">
          <span
            className={`absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ease-fluid ${
              open ? "top-1.5 rotate-45" : "top-0"
            }`}
          />
          <span
            className={`absolute bottom-0 left-0 block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ease-fluid ${
              open ? "bottom-1.5 -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.siteNavigation")}
          className="fixed inset-0 z-[100] flex animate-overlay-in flex-col bg-ink-950/95 xl:hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-1/4 top-0 h-[60vh] w-[150%] animate-aurora rounded-full bg-brand-500/15 blur-3xl"
          />
          <CourtMarkings
            variant="hero"
            className="pointer-events-none absolute -right-20 top-8 h-[420px] w-[420px] -scale-x-100 opacity-80"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-court-floor"
          />

          <nav className="relative flex flex-1 flex-col justify-center px-7">
            <ul className="space-y-1">
              {PRIMARY_LINKS.map((l, i) => {
                const active =
                  pathname === l.href || pathname.startsWith(`${l.href}/`)
                return (
                  <li
                    key={l.href}
                    className="animate-nav-rise"
                    style={{ animationDelay: `${0.06 * i + 0.08}s` }}
                  >
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className="group flex items-baseline gap-3"
                    >
                      <span className="font-mono text-[11px] tabular-nums text-brand-400/70">
                        0{i + 1}
                      </span>
                      <span
                        className={`font-display text-4xl font-bold tracking-[-0.03em] transition-colors duration-300 ${
                          active
                            ? "text-gradient-brand"
                            : "text-ink-100 group-hover:text-ink-50"
                        }`}
                      >
                        {t(l.labelKey)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div
              className="mt-10 animate-nav-rise"
              style={{ animationDelay: "0.5s" }}
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                {t("common.byLeague")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LEAGUE_FILTER_TREE.map((node) => (
                  <Link
                    key={node.slug}
                    href={`/players?league=${node.slug}`}
                    className="gh-chip text-ink-200 transition-colors duration-200 hover:border-brand-400/40 hover:text-brand-200"
                  >
                    {node.label}
                  </Link>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-l-2 border-brand-500/30 pl-2.5">
                {FEB_CHILDREN.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/players?league=${c.slug}`}
                    className="gh-chip text-xs text-ink-300 transition-colors duration-200 hover:border-brand-400/40 hover:text-brand-200"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div
            className="relative hairline-t animate-nav-rise space-y-4 px-7 py-6"
            style={{ animationDelay: "0.58s" }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                {t("language.label")}
              </span>
              <LanguageSwitcher variant="inline" />
            </div>
            <Link
              href="/compare"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-4 py-3.5 text-center text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition-colors duration-300 hover:bg-brand-400"
            >
              {t("common.openConsole")}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
