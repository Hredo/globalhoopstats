import { FadeIn } from "@/components/animations/fade-in"
import { SectionHeading } from "@/components/ui/section-heading"
import { ButtonLink } from "@/components/ui/button"
import { getT } from "@/lib/i18n/server"

type Feature = {
  n: string
  key: "compare" | "leagues" | "ai"
  ctaHref: string
  visual: "compare" | "radar" | "shot"
  badge?: string
}

const FEATURES: Feature[] = [
  { n: "01", key: "compare", ctaHref: "/compare", visual: "compare" },
  { n: "02", key: "leagues", ctaHref: "/leagues", visual: "radar" },
  { n: "03", key: "ai", ctaHref: "/ai-advisor", visual: "shot", badge: "Beta" },
]

/** Two overlaid radar polygons on one field — the real "compare" gesture:
 *  same axes, two players, the winner's shape reads instantly. */
function CompareVisual() {
  const AXES = ["PTS", "REB", "AST", "TS%", "PER", "STL"]
  const A = [0.92, 0.42, 0.66, 0.86, 0.8, 0.55]
  const B = [0.6, 0.88, 0.9, 0.64, 0.72, 0.7]
  const cx = 160
  const cy = 100
  const rmax = 74
  const pt = (vals: number[]) =>
    vals
      .map((v, i) => {
        const ang = (i / AXES.length) * Math.PI * 2 - Math.PI / 2
        return `${cx + Math.cos(ang) * rmax * v},${cy + Math.sin(ang) * rmax * v}`
      })
      .join(" ")
  return (
    <svg
      viewBox="0 0 320 200"
      className="h-full w-full"
      role="img"
      aria-label="Two players overlaid on one radar of advanced metrics"
    >
      <defs>
        <linearGradient id="cg1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.75 0.19 52)" />
          <stop offset="1" stopColor="oklch(0.6 0.21 30)" />
        </linearGradient>
        <linearGradient id="cg2" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.78 0.13 220)" />
          <stop offset="1" stopColor="oklch(0.56 0.18 262)" />
        </linearGradient>
      </defs>
      {/* rings + spokes */}
      {[0.33, 0.66, 1].map((r) => (
        <polygon
          key={r}
          points={pt(AXES.map(() => r))}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth="0.7"
        />
      ))}
      {AXES.map((ax, i) => {
        const ang = (i / AXES.length) * Math.PI * 2 - Math.PI / 2
        return (
          <g key={ax}>
            <line
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(ang) * rmax}
              y2={cy + Math.sin(ang) * rmax}
              stroke="var(--color-hairline)"
              strokeWidth="0.6"
            />
            <text
              x={cx + Math.cos(ang) * (rmax + 12)}
              y={cy + Math.sin(ang) * (rmax + 12) + 3}
              textAnchor="middle"
              fontSize="7.5"
              fill="var(--color-ink-400)"
              fontFamily="var(--font-mono), monospace"
            >
              {ax}
            </text>
          </g>
        )
      })}
      {/* player B under, player A over */}
      <polygon
        points={pt(B)}
        fill="url(#cg2)"
        fillOpacity="0.22"
        stroke="url(#cg2)"
        strokeWidth="1.6"
        className="animate-pulse-soft"
      />
      <polygon
        points={pt(A)}
        fill="url(#cg1)"
        fillOpacity="0.24"
        stroke="url(#cg1)"
        strokeWidth="1.8"
      />
      {/* legend */}
      <g fontFamily="var(--font-mono), monospace" fontSize="8">
        <circle cx="14" cy="16" r="3.5" fill="url(#cg1)" />
        <text x="22" y="19" fill="var(--color-ink-200)">Dončić</text>
        <circle cx="14" cy="30" r="3.5" fill="url(#cg2)" />
        <text x="22" y="33" fill="var(--color-ink-200)">SGA</text>
      </g>
    </svg>
  )
}

/** A cross-league leaderboard: rank chips, league-colored dots, filled bars
 *  and a value column — the kind of table the league hubs render. */
function RadarVisual() {
  const ROWS = [
    { name: "Gilgeous-Alexander", league: "oklch(0.71 0.19 50)", tag: "NBA", val: "31.4", bar: 1 },
    { name: "Trae Young", league: "oklch(0.71 0.19 50)", tag: "NBA", val: "26.4", bar: 0.84 },
    { name: "Markus Howard", league: "oklch(0.56 0.18 264)", tag: "EL", val: "19.2", bar: 0.62 },
    { name: "Dzanan Musa", league: "oklch(0.6 0.21 25)", tag: "ACB", val: "14.7", bar: 0.47 },
  ]
  return (
    <svg
      viewBox="0 0 320 200"
      className="h-full w-full"
      role="img"
      aria-label="Cross-league scoring leaderboard"
    >
      <text x="14" y="18" fontSize="8.5" fill="var(--color-ink-400)" fontFamily="var(--font-mono), monospace" letterSpacing="1">
        LÍDERES · PPG
      </text>
      <text x="306" y="18" textAnchor="end" fontSize="8.5" fill="var(--color-brand-300)" fontFamily="var(--font-mono), monospace">
        4 LIGAS
      </text>
      {ROWS.map((r, i) => (
        <g key={r.name} transform={`translate(14 ${30 + i * 40})`}>
          <rect width="292" height="32" rx="7" fill="var(--color-surface-1)" stroke="var(--color-hairline)" strokeWidth="0.6" />
          <text x="14" y="21" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-ink-300)" fontFamily="var(--font-mono), monospace">
            {i + 1}
          </text>
          <circle cx="34" cy="16" r="5" fill={r.league} />
          <text x="47" y="14" fontSize="8.5" fill="var(--color-ink-100)" fontFamily="var(--font-sans), system-ui" fontWeight="600">
            {r.name}
          </text>
          <rect x="47" y="20" width="120" height="4" rx="2" fill="var(--color-surface-3)" />
          <rect x="47" y="20" width={120 * r.bar} height="4" rx="2" fill={r.league} />
          <text x="222" y="20" fontSize="7" fill="var(--color-ink-500)" fontFamily="var(--font-mono), monospace">
            {r.tag}
          </text>
          <text x="286" y="21" textAnchor="end" fontSize="11" fontWeight="700" fill="var(--color-ink-50)" fontFamily="var(--font-mono), monospace">
            {r.val}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** The AI advisor as a scout: a chat exchange with a source-cited verdict —
 *  what the /ai-advisor feature actually produces. */
function ShotVisual() {
  return (
    <svg
      viewBox="0 0 320 200"
      className="h-full w-full"
      role="img"
      aria-label="AI advisor conversation with a cited scouting verdict"
    >
      <defs>
        <linearGradient id="ai-b" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.72 0.2 50 / 0.35)" />
          <stop offset="1" stopColor="oklch(0.6 0.21 30 / 0.18)" />
        </linearGradient>
      </defs>
      {/* user query bubble */}
      <g transform="translate(120 16)">
        <rect width="186" height="30" rx="10" fill="var(--color-surface-1)" stroke="var(--color-hairline)" strokeWidth="0.6" />
        <text x="12" y="14" fontSize="8" fill="var(--color-ink-200)" fontFamily="var(--font-sans), system-ui">¿Quién encaja mejor</text>
        <text x="12" y="24" fontSize="8" fill="var(--color-ink-200)" fontFamily="var(--font-sans), system-ui">como base titular?</text>
      </g>
      {/* AI answer bubble */}
      <g transform="translate(14 56)">
        <rect width="220" height="72" rx="12" fill="url(#ai-b)" stroke="oklch(0.72 0.2 50 / 0.4)" strokeWidth="0.8" />
        <circle cx="16" cy="16" r="7" fill="oklch(0.72 0.2 50 / 0.5)" />
        <path d="M12.5 16 l2.5 2.5 l4.5 -5" stroke="oklch(0.95 0.02 60)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="30" y="15" fontSize="7.5" fill="var(--color-brand-200)" fontFamily="var(--font-mono), monospace" letterSpacing="0.5">ASESOR IA</text>
        <rect x="12" y="28" width="196" height="4.5" rx="2.2" fill="var(--color-ink-400)" />
        <rect x="12" y="38" width="180" height="4.5" rx="2.2" fill="var(--color-ink-500)" />
        <rect x="12" y="48" width="150" height="4.5" rx="2.2" fill="var(--color-ink-500)" />
        <rect x="12" y="58" width="90" height="4.5" rx="2.2" fill="var(--color-brand-400)" />
      </g>
      {/* cited-source chips */}
      <g transform="translate(14 138)" fontFamily="var(--font-mono), monospace" fontSize="7">
        <rect width="66" height="16" rx="8" fill="var(--color-surface-1)" stroke="var(--color-hairline)" strokeWidth="0.6" />
        <text x="33" y="11" textAnchor="middle" fill="var(--color-ink-300)">TS% · 61.2</text>
        <g transform="translate(74 0)">
          <rect width="66" height="16" rx="8" fill="var(--color-surface-1)" stroke="var(--color-hairline)" strokeWidth="0.6" />
          <text x="33" y="11" textAnchor="middle" fill="var(--color-ink-300)">AST% · 34</text>
        </g>
        <g transform="translate(148 0)">
          <rect width="72" height="16" rx="8" fill="oklch(0.72 0.2 50 / 0.14)" stroke="oklch(0.72 0.2 50 / 0.4)" strokeWidth="0.6" />
          <text x="36" y="11" textAnchor="middle" fill="var(--color-brand-200)">VEREDICTO</text>
        </g>
      </g>
      {/* typing dots */}
      <g transform="translate(200 172)">
        <circle cx="0" cy="0" r="2.4" fill="var(--color-ink-500)" className="animate-pulse-soft" />
        <circle cx="9" cy="0" r="2.4" fill="var(--color-ink-500)" className="animate-pulse-soft" style={{ animationDelay: "0.2s" }} />
        <circle cx="18" cy="0" r="2.4" fill="var(--color-ink-500)" className="animate-pulse-soft" style={{ animationDelay: "0.4s" }} />
      </g>
    </svg>
  )
}

function Visual({ kind }: { kind: Feature["visual"] }) {
  if (kind === "compare") return <CompareVisual />
  if (kind === "radar") return <RadarVisual />
  return <ShotVisual />
}

export async function FeatureShowcase() {
  const { t } = await getT()
  return (
    <section
      aria-label={t("home.features.eyebrow")}
      className="relative hairline-t py-20 sm:py-28"
    >
      <FadeIn>
        <SectionHeading
          align="center"
          eyebrow={t("home.features.eyebrow")}
          title={
            <>
              {t("home.features.titleA")}{" "}
              <span className="text-gradient-brand">
                {t("home.features.titleB")}
              </span>
            </>
          }
          description={t("home.features.description")}
        />
      </FadeIn>

      <div className="mt-12 space-y-5 sm:space-y-6">
        {FEATURES.map((f, i) => {
          const reversed = i % 2 === 1
          const base = `home.features.${f.key}`
          const bullets = [t(`${base}.b1`), t(`${base}.b2`), t(`${base}.b3`)]
          return (
            <FadeIn key={f.n} delay={0.05 * (i + 1)} y={24}>
              <article className="gh-card relative grid items-stretch overflow-hidden md:grid-cols-2">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent"
                />
                <div
                  className={`p-6 sm:p-8 md:p-10 ${reversed ? "md:order-2" : "md:order-1"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-brand-300">
                      {f.n}
                    </span>
                    <span className="h-px w-8 bg-hairline-strong" />
                    {f.badge ? (
                      <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                        {f.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-ink-50 sm:text-3xl">
                    {t(`${base}.title`)}
                  </h3>
                  <p className="mt-3 text-pretty text-sm leading-relaxed text-ink-200 sm:text-base">
                    {t(`${base}.body`)}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2.5 text-sm text-ink-200"
                      >
                        <svg
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0 text-brand-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <ButtonLink
                    href={f.ctaHref}
                    variant="secondary"
                    size="sm"
                    arrow
                    className="mt-7"
                  >
                    {t(`${base}.cta`)}
                  </ButtonLink>
                </div>
                <div
                  className={`flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent p-6 hairline-b sm:p-8 md:p-10 md:border-b-0 ${
                    reversed
                      ? "md:order-1 md:border-r md:border-hairline"
                      : "md:order-2 md:border-l md:border-hairline"
                  }`}
                >
                  <div className="aspect-[16/10] w-full max-w-md rounded-xl border border-hairline bg-surface-0/60 p-3">
                    <Visual kind={f.visual} />
                  </div>
                </div>
              </article>
            </FadeIn>
          )
        })}
      </div>
    </section>
  )
}
