"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"

/**
 * The small anchored panel every workspace action opens (follow thresholds,
 * shortlist picker, share link). Closes on outside press and Escape; on phones
 * it becomes a bottom sheet, because an anchored popover under a button near
 * the screen edge is half off-screen there.
 */
export function ActionPopover({
  trigger,
  children,
  align = "left",
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: "left" | "right"
  label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open ? (
        <>
          <div aria-hidden className="fixed inset-0 z-[110] bg-ink-950/40 sm:hidden" />
          <div
            role="dialog"
            aria-label={label}
            className={cn(
              "z-[120] animate-overlay-in border border-hairline bg-surface-2 p-4 shadow-[var(--shadow-court)]",
              "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[80dvh] max-sm:overflow-y-auto max-sm:rounded-t-3xl max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
              "sm:absolute sm:top-full sm:mt-2 sm:w-[340px] sm:rounded-2xl",
              align === "right" ? "sm:right-0" : "sm:left-0",
            )}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export const actionButton =
  "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors duration-200 disabled:opacity-60"
export const actionIdle = "border-hairline bg-white/[0.03] text-ink-200 hover:border-brand-500/40 hover:text-ink-50"
export const actionOn = "border-brand-500/40 bg-brand-500/15 text-brand-200 hover:bg-brand-500/20"
export const fieldClass =
  "w-full rounded-lg border border-hairline bg-white/[0.03] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500/60 focus:outline-none"
export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-brand-400 disabled:opacity-60"
