import type { ReactNode } from "react"
import { Reveal } from "@/components/animations/reveal"
import { Eyebrow } from "@/components/ui/eyebrow"
import { StatFigure } from "@/components/ui/stat-figure"
import { leagueAccent } from "@/components/ui/league-badge"

type Stat = { value: ReactNode; label: ReactNode }

export function DirectoryHero({
  eyebrow,
  title,
  description,
  stats,
  league,
}: {
  eyebrow: ReactNode
  title: ReactNode
  description: ReactNode
  stats?: Stat[]
  league?: string
}) {
  const accent = league ? leagueAccent(league) : null

  return (
    <header className="full-bleed relative isolate overflow-hidden pb-2 pt-10 sm:pt-14">
      {/* League-themed ambient glow */}
      {accent ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15] transition-all duration-700 ease-fluid"
          style={{
            backgroundImage: `
              radial-gradient(50% 60% at 0% 0%, ${accent.color}, transparent 70%),
              radial-gradient(40% 50% at 100% 0%, ${accent.color}, transparent 70%)
            `,
          }}
        />
      ) : null}

      {/* Giant muted league badge as background typography */}
      {accent ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 select-none overflow-hidden font-display font-black leading-none opacity-[0.04] sm:opacity-[0.06]"
          style={{
            fontSize: "clamp(6rem, 20vw, 16rem)",
            color: accent.color,
            lineHeight: 0.8,
          }}
        >
          <span className="block text-right">{accent.short}</span>
        </div>
      ) : null}

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
            <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-ink-200 sm:text-base">
              {description}
            </p>
          </Reveal>
        </div>
        {stats && stats.length > 0 ? (
          <Reveal delay={0.16} direction="left">
            <div className="flex shrink-0 items-end gap-8 hairline-t pt-5 md:border-t-0 md:pt-0">
              {stats.map((s, i) => (
                <StatFigure
                  key={i}
                  value={s.value}
                  label={s.label}
                  size="lg"
                  accent={accent?.color}
                />
              ))}
            </div>
          </Reveal>
        ) : null}
      </div>
      </div>
    </header>
  )
}
