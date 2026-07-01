"use client"

import { useRef, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"

type TiltCardProps = {
  children: ReactNode
  className?: string
  /** Max tilt in degrees on each axis. Keep it subtle for editorial feel. */
  max?: number
  /** Render the cursor-tracked glare sheen (adds .gh-glare). */
  glare?: boolean
  /** Optional wrapper element props (e.g. aria). */
  as?: "div" | "article" | "li"
}

/**
 * Pointer-driven 3D tilt wrapper. Pure CSS transforms driven by inline custom
 * properties (--rx/--ry for the tilt, --gx/--gy for the glare position), updated
 * imperatively in a rAF so it never triggers React re-renders. Respects
 * prefers-reduced-motion via the `.gh-tilt` rule in globals.css (transform:none).
 *
 * The child content should live on its own layer; add `preserve-3d` +
 * `gh-tilt-lift` to inner elements you want to pop toward the viewer.
 */
export function TiltCard({
  children,
  className,
  max = 8,
  glare = true,
  as = "div",
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const raf = useRef(0)

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width // 0..1
    const py = (e.clientY - rect.top) / rect.height // 0..1
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const ry = (px - 0.5) * 2 * max
      const rx = (0.5 - py) * 2 * max
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`)
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`)
      el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`)
      el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`)
    })
  }

  function reset() {
    const el = ref.current
    if (!el) return
    if (raf.current) cancelAnimationFrame(raf.current)
    el.style.setProperty("--rx", "0deg")
    el.style.setProperty("--ry", "0deg")
  }

  const Tag = as
  return (
    <div className="perspective-near h-full">
      <Tag
        ref={ref as never}
        onPointerMove={onMove}
        onPointerLeave={reset}
        className={cn("gh-tilt h-full", glare && "gh-glare", className)}
      >
        {children}
      </Tag>
    </div>
  )
}
