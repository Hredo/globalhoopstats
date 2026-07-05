import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Eyebrow } from "@/components/ui/eyebrow"

/**
 * Section header in the crest voice: jersey-patch eyebrow, wide-caps
 * headline, and — for left-aligned headers — the measurement rule:
 * a ticked baseline that runs the full column width, like the ruled
 * head of a box score.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  titleClassName,
  rule,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: "left" | "center"
  className?: string
  titleClassName?: string
  rule?: boolean
}) {
  const showRule = rule ?? align === "left"
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center"
          ? "mx-auto max-w-2xl items-center text-center"
          : "items-start",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "text-display text-balance text-[2rem] text-ink-50 sm:text-[2.6rem] md:text-[3.1rem]",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-pretty text-base leading-relaxed text-ink-200 sm:text-lg",
            align === "center" ? "max-w-xl" : "max-w-2xl",
          )}
        >
          {description}
        </p>
      ) : null}
      {showRule ? (
        <div
          aria-hidden
          className="gh-ticks mt-1 h-2 w-full self-stretch border-b border-hairline-strong"
        />
      ) : null}
    </div>
  )
}
