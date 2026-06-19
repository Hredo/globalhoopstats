import { FadeIn } from "@/components/animations/fade-in"
import { getT } from "@/lib/i18n/server"

const SOURCES = [
  {
    label: "NBA",
    color: "text-league-nba-300",
    border: "border-league-nba-500/30",
    bg: "bg-league-nba-500/5",
  },
  {
    label: "EuroLeague",
    color: "text-league-euro-300",
    border: "border-league-euro-500/30",
    bg: "bg-league-euro-500/5",
  },
  {
    label: "Liga ACB",
    color: "text-league-acb-300",
    border: "border-league-acb-500/30",
    bg: "bg-league-acb-500/5",
  },
]

export async function TrustBar() {
  const { t } = await getT()
  return (
    <section
      aria-labelledby="trustbar-heading"
      className="relative hairline-t py-16 sm:py-20"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid-fade opacity-20"
      />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              {t("home.trustBar.eyebrow")}
            </p>
            <h2
              id="trustbar-heading"
              className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-ink-50 sm:text-4xl"
            >
              {t("home.trustBar.titleA")}{" "}
              <span className="text-gradient-brand">
                {t("home.trustBar.titleB")}
              </span>
            </h2>
            <p className="mt-3 text-pretty text-sm text-ink-200 sm:text-[15px]">
              {t("home.trustBar.description")}
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.08}>
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {SOURCES.map((s) => (
              <li
                key={s.label}
                className={`flex items-center justify-between gap-3 rounded-2xl border ${s.border} ${s.bg} px-5 py-4`}
              >
                <span
                  className={`font-display text-base font-bold sm:text-lg ${s.color}`}
                >
                  {s.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
                  {t("home.trustBar.publicFeed")}
                </span>
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={0.16}>
          <p className="mx-auto mt-7 max-w-2xl text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
            {t("home.trustBar.footnote")}
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
