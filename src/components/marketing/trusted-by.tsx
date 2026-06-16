import { FadeIn } from "@/components/animations/fade-in"
import { leagueAccent } from "@/components/ui/league-badge"
import { getT } from "@/lib/i18n/server"

const LEAGUES = [
  { name: "NBA", slug: "nba" },
  { name: "EuroLeague", slug: "euroleague" },
  { name: "Liga ACB", slug: "acb" },
  { name: "LEB Oro", slug: "leb-oro" },
  { name: "LEB Plata", slug: "leb-plata" },
  { name: "EBA", slug: "eba" },
]

const PILOT_USER_KEYS = [
  "home.trustedBy.pilots.scouting",
  "home.trustedBy.pilots.ncaa",
  "home.trustedBy.pilots.agencies",
  "home.trustedBy.pilots.journalism",
  "home.trustedBy.pilots.academies",
  "home.trustedBy.pilots.fantasy",
]

export async function TrustedBy() {
  const { t } = await getT()
  return (
    <section
      aria-label={t("home.trustedBy.aria")}
      className="relative hairline-t hairline-b bg-surface-0/40 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <div className="grid items-center gap-8 md:grid-cols-[1fr_2fr]">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                {t("home.trustedBy.eyebrow")}
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-ink-50 sm:text-3xl">
                {t("home.trustedBy.titleA")}{" "}
                <span className="text-gradient-brand">
                  {t("home.trustedBy.titleB")}
                </span>
              </h2>
              <p className="mt-3 text-pretty text-sm text-ink-300 sm:text-[15px]">
                {t("home.trustedBy.description")}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {LEAGUES.map((l) => {
                const a = leagueAccent(l.slug)
                return (
                  <li
                    key={l.name}
                    className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 transition-colors duration-200 hover:border-hairline-strong"
                  >
                    <span className="flex items-center gap-2 font-display text-sm font-bold text-ink-100 sm:text-base">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: a.color }}
                      />
                      {l.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      {t("home.trustedBy.live")}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500">
            {t("home.trustedBy.earlyAccess")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 sm:gap-3">
            {PILOT_USER_KEYS.map((key) => (
              <li
                key={key}
                className="rounded-full border border-hairline bg-white/[0.03] px-3.5 py-1.5 text-xs text-ink-200"
              >
                {t(key)}
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </section>
  )
}
