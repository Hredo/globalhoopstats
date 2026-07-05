import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"

export function StatFigure({
  value,
  label,
  hint,
  accent,
  size = "md",
  className,
}: {
  value: ReactNode
  label: ReactNode
  hint?: ReactNode
  accent?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const valueSize =
    size === "lg"
      ? "text-4xl sm:text-5xl"
      : size === "sm"
        ? "text-xl"
        : "text-2xl sm:text-3xl"
  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn("text-numeral", valueSize)}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      <span className="text-condensed mt-1.5 text-[10px] tracking-[0.16em] text-ink-400 sm:text-[11px]">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 text-xs text-ink-500">{hint}</span>
      ) : null}
    </div>
  )
}
