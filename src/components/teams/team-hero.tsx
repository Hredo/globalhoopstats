import { TeamLogoHero } from "@/components/teams/team-logo-hero"
import { TeamLeagueSwitcher } from "@/components/ui/league-switcher"

type Props = {
  name: string
  slug: string
  logoUrl: string | null
  league: { name: string; slug: string; region: string }
  availableLeagues: { name: string; slug: string; region: string }[]
  city: string | null
  switchLabel: string
}

export function TeamHero({
  name,
  slug,
  logoUrl,
  league,
  availableLeagues,
  city,
  switchLabel,
}: Props) {
  const location = city
  return (
    <section
      className="team-hero relative overflow-hidden rounded-2xl border border-hairline px-6 py-10 shadow-[var(--shadow-elev-1)] sm:px-10 sm:py-14"
      style={{
        background:
          "radial-gradient(ellipse 140% 80% at 50% -20%, color-mix(in oklch, var(--team-500) 14%, transparent), transparent 65%), linear-gradient(180deg, oklch(1 0 0 / 0.02), transparent)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--team-400), transparent)",
        }}
      />
      <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(240px,320px)_1fr]">
        <TeamLogoHero src={logoUrl} name={name} shortName={null} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--team-300)]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--team-400)" }}
            />
            <span>{league.name}</span>
            {location ? (
              <>
                <span className="text-ink-500">·</span>
                <span className="text-ink-400">{location}</span>
              </>
            ) : null}
          </div>
          <h1
            className="mt-3 break-words font-display text-4xl font-bold leading-[0.9] tracking-[-0.04em] sm:text-5xl md:text-6xl"
            style={{ color: "var(--team-200)" }}
          >
            {name}
          </h1>
          {availableLeagues.length > 1 ? (
            <div className="mt-5">
              <TeamLeagueSwitcher
                leagues={availableLeagues}
                activeSlug={league.slug}
                teamSlug={slug}
                ariaLabel={switchLabel}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
