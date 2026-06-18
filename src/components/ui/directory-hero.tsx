import type { ReactNode } from "react"
import { Reveal } from "@/components/animations/reveal"
import { Eyebrow } from "@/components/ui/eyebrow"
import { StatFigure } from "@/components/ui/stat-figure"
import { CourtMarkings } from "@/components/ui/court-markings"

type Stat = { value: ReactNode; label: ReactNode }

export function DirectoryHero({
  eyebrow,
  title,
  description,
  stats,
}: {
  eyebrow: ReactNode
  title: ReactNode
  description: ReactNode
  stats?: Stat[]
}) {
  return (
    <header className="full-bleed relative isolate overflow-hidden pb-2 pt-10 sm:pt-14">
      <CourtMarkings
        variant="band"
        className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-72 w-full opacity-70"
        style={{
          WebkitMaskImage:
            "radial-gradient(115% 120% at 50% -10%, black, transparent 70%)",
          maskImage:
            "radial-gradient(115% 120% at 50% -10%, black, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-court-floor"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
        <div>
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-4 font-display text-6xl font-bold leading-[0.84] tracking-[-0.045em] text-ink-50 sm:text-7xl md:text-8xl">
              {title}
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-ink-300 sm:text-base">
              {description}
            </p>
          </Reveal>
        </div>
        {stats && stats.length > 0 ? (
          <Reveal delay={0.16} direction="left">
            <div className="flex shrink-0 items-end gap-8 hairline-t pt-5 md:border-t-0 md:pt-0">
              {stats.map((s, i) => (
                <StatFigure key={i} value={s.value} label={s.label} size="lg" />
              ))}
            </div>
          </Reveal>
        ) : null}
      </div>
      </div>
    </header>
  )
}
