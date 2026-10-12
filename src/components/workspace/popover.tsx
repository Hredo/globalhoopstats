"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/components/ui/cn"

const PANEL_WIDTH = 340
const GAP = 8
const EDGE = 12

/**
 * The small anchored panel every workspace action opens (follow thresholds,
 * shortlist picker, share link). Closes on outside press and Escape; on phones
 * it becomes a bottom sheet, because an anchored popover under a button near
 * the screen edge is half off-screen there.
 *
 * The panel is portalled to <body> and positioned against the trigger: the
 * sections below it (stat cards, animated blocks) open their own stacking
 * contexts, so an in-flow absolute panel got painted under them whatever its
 * z-index.
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2)
    const preferred = align === "right" ? rect.right - width : rect.left
    const left = Math.max(
      EDGE,
      Math.min(preferred, window.innerWidth - width - EDGE),
    )
    setPos({ top: rect.bottom + GAP, left })
  }, [align])

  // Runs before paint, so a stale position from the last opening never shows.
  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        anchorRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return
      setOpen(false)
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
    <div ref={anchorRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && pos
        ? createPortal(
            <>
              <div
                aria-hidden
                className="fixed inset-0 z-[110] bg-ink-950/40 sm:hidden"
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-label={label}
                style={
                  {
                    "--pop-top": `${pos.top}px`,
                    "--pop-left": `${pos.left}px`,
                  } as CSSProperties
                }
                className={cn(
                  "fixed z-[120] animate-overlay-in border border-hairline bg-surface-2 p-4 shadow-[var(--shadow-court)]",
                  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[80dvh] max-sm:overflow-y-auto max-sm:rounded-t-3xl max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
                  "sm:top-[var(--pop-top)] sm:left-[var(--pop-left)] sm:w-[340px] sm:max-w-[calc(100vw-24px)] sm:rounded-2xl",
                )}
              >
                {children(() => setOpen(false))}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}

export const actionButton =
  "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors duration-200 disabled:opacity-60"
export const actionIdle =
  "border-hairline bg-white/[0.03] text-ink-200 hover:border-brand-500/40 hover:text-ink-50"
export const actionOn =
  "border-brand-500/40 bg-brand-500/15 text-brand-200 hover:bg-brand-500/20"
export const fieldClass =
  "w-full rounded-lg border border-hairline bg-white/[0.03] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500/60 focus:outline-none"
export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-brand-400 disabled:opacity-60"
