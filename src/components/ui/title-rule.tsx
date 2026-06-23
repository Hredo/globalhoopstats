import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"

/**
 * Wraps a headline with a warm vertical accent bar in the left margin — the
 * "spine" of a heading. Purely presentational; see `.gh-title-rule`.
 */
export function TitleRule({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("gh-title-rule", className)}>{children}</div>
}
