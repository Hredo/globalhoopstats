import type { ReactNode } from "react"
import { Reveal } from "@/components/animations/reveal"
import { Eyebrow } from "@/components/ui/eyebrow"
import { TitleRule } from "@/components/ui/title-rule"
import { StatFigure } from "@/components/ui/stat-figure"
import { leagueAccent } from "@/components/ui/league-badge"

type Stat = { value: ReactNode; label: ReactNode }

export function DirectoryHero({
  eyebrow,
  title,
  description,
  stats,
  league,
  accents,
}: {
  eyebrow: ReactNode
  title: ReactNode
  description: ReactNode
  stats?: Stat[]
  league?: string
  /** Multi-league index pages: accent colours to paint an ambient spectrum. */
  accents?: string[]
}) {
  const accent = league ? leagueAccent(league) : null
  const spectrum = !accent && accents && accents.length > 0 ? accents : null

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

      {/* Multi-league ambient: a glow per league across the top + a thin
          spectrum rule, so the index hero carries the brand's full palette. */}
      {spectrum ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage: spectrum
                .map((c, i) => {
                  const x =
                    spectrum.length === 1
                      ? 50
                      : Math.round((i / (spectrum.length - 1)) * 100)
                  return `radial-gradient(30% 46% at ${x}% -6%, ${c}, transparent 70%)`
                })
                .join(","),
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
            style={{
              backgroundImage: `linear-gradient(to right, transparent, ${spectrum.join(
                ",",
              )}, transparent)`,
            }}
          />
        </>
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
            <TitleRule className="mt-4">
              <h1 className="font-display text-[3.25rem] font-semibold leading-[0.96] tracking-[-0.015em] text-balance text-ink-50 sm:text-7xl md:text-8xl">
                {title}
              </h1>
            </TitleRule>
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
