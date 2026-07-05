import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"

/**
 * Jersey-patch label: a small solid tick square + compressed caps.
 * The tick carries the color; the text stays quiet ink.
 */
export function Eyebrow({
  children,
  className,
  tone = "brand",
}: {
  children: ReactNode
  className?: string
  tone?: "brand" | "muted"
}) {
  return (
    <span
      className={cn(
        "text-condensed inline-flex items-center gap-2.5 text-[11px] tracking-[0.15em] text-ink-500",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 flex-none",
          tone === "brand" ? "bg-brand-500" : "bg-ink-700",
        )}
      />
      {children}
    </span>
  )
}
