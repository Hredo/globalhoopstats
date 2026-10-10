"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { NavIcon } from "@/components/layout/nav-icons"
import { NavEntry, LeagueChips } from "@/components/layout/nav-panel"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { useT } from "@/lib/i18n/provider"
import { isActivePath, NAV_GROUPS } from "@/lib/nav/sections"

/**
 * Phone menu: the same button as always in the top bar, opening the whole site
 * map as a compact grid — icon and name per destination, grouped like the
 * desktop bar — so everything fits one screen without paragraphs to read.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useT()

  useEffect(() => {
    setOpen(false) // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
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
        className="relative z-[110] inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white/[0.05] text-ink-100 transition-colors duration-300 hover:border-brand-400/40 lg:hidden"
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

      {open &&
        createPortal(
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.siteNavigation")}
          className="fixed inset-0 z-[100] flex animate-overlay-in flex-col overflow-y-auto overscroll-contain bg-ink-950/95 backdrop-blur-md lg:hidden"
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <span className="font-display text-lg font-bold tracking-[-0.02em] text-ink-50">
              globalhoopstats<span className="text-brand-500">.</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("nav.closeMenu")}
              className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-white/[0.05] text-ink-100"
            >
              <NavIcon name="close" className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex-1 space-y-5 px-3">
            {NAV_GROUPS.map((g, gi) => (
              <section key={g.id} className="animate-nav-rise" style={{ animationDelay: `${0.05 * gi + 0.05}s` }}>
                <h2 className="px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  {t(`nav.groups.${g.id}`)}
                </h2>
                <div className="mt-1 grid grid-cols-2 gap-0.5">
                  {g.items.map((item) => (
                    <NavEntry
                      key={item.href}
                      item={item}
                      compact
                      active={isActivePath(pathname, item.href)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              </section>
            ))}

            <section className="animate-nav-rise px-2" style={{ animationDelay: "0.2s" }}>
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                {t("nav.panel.leaguesTitle")}
              </h2>
              <div className="mt-3">
                <LeagueChips onNavigate={() => setOpen(false)} />
              </div>
            </section>
          </nav>

          <div className="hairline-t mt-6 flex items-center justify-between gap-3 px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              {t("language.label")}
            </span>
            <LanguageSwitcher variant="inline" />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
