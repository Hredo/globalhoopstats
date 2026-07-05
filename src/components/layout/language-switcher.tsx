"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LOCALES, type Locale } from "@/lib/i18n/config"
import { useLocale, useT } from "@/lib/i18n/provider"
import { cn } from "@/components/ui/cn"

// Autonyms — each language is shown in its own name, the standard pattern for
// language pickers (a Spanish speaker still recognises "English" and vice versa).
const NAMES: Record<Locale, { label: string; short: string }> = {
  en: { label: "English", short: "EN" },
  es: { label: "Español", short: "ES" },
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  )
}

/**
 * Language picker. `navbar` renders a compact globe button with a small popover;
 * `inline` renders a segmented control for the settings page.
 */
export function LanguageSwitcher({
  variant = "navbar",
}: {
  variant?: "navbar" | "inline"
}) {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Locale | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
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

  async function choose(next: Locale) {
    setOpen(false)
    if (next === locale || pending) return
    setPending(next)
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      })
      router.refresh()
    } catch {
      // no-op: the user can try again
    } finally {
      setPending(null)
    }
  }

  if (variant === "inline") {
    return (
      <div
        role="group"
        aria-label={t("language.change")}
        className="inline-flex rounded-md border border-hairline bg-white/[0.04] p-1"
      >
        {LOCALES.map((loc) => {
          const active = loc === locale
          return (
            <button
              key={loc}
              type="button"
              onClick={() => choose(loc)}
              aria-pressed={active}
              disabled={pending !== null}
              className={cn(
                "rounded-[4px] px-4 py-1.5 text-sm font-medium transition-colors duration-200 disabled:opacity-60",
                active
                  ? "bg-brand-600 text-ink-950"
                  : "text-ink-300 hover:text-ink-50",
              )}
            >
              {NAMES[loc].label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language.change")}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-white/[0.05] px-2 text-ink-200 transition-colors duration-300 hover:border-hairline-strong hover:text-ink-50 sm:px-2.5"
      >
        <GlobeIcon className="h-4 w-4" />
        <span className="font-mono text-[11px] font-semibold tracking-[0.08em] max-sm:hidden">
          {NAMES[locale].short}
        </span>
      </button>

      <div
        role="menu"
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-40 origin-top-right rounded-lg border border-hairline bg-surface-2/95 p-1.5 shadow-[var(--shadow-court)] backdrop-blur-xl transition-all duration-200 ease-fluid",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1.5 opacity-0",
        )}
      >
        {LOCALES.map((loc) => {
          const active = loc === locale
          return (
            <button
              key={loc}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              tabIndex={open ? undefined : -1}
              onClick={() => choose(loc)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-200",
                active
                  ? "bg-white/[0.06] text-ink-50"
                  : "text-ink-200 hover:bg-white/[0.05] hover:text-ink-50",
              )}
            >
              {NAMES[loc].label}
              {active && (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="h-3.5 w-3.5 text-brand-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 13 4 4L19 7"
                  />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
