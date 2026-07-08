import { Reveal } from "@/components/animations/reveal"
import { getT } from "@/lib/i18n/server"

/** Three source-of-truth icons for the provenance points. */
function SourceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2" />
      <path d="M8 9h8M8 13h5" />
      <path d="M3 12l3 3-3 3" />
    </svg>
  )
}
function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16M6 8h12" />
      <path d="M6 8l-3 6a3 3 0 0 0 6 0L6 8zM18 8l-3 6a3 3 0 0 0 6 0l-3-6z" />
    </svg>
  )
}
function FreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v4h-4" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

/**
 * "Where the data comes from" — a trust anchor pulled OUT of the FAQ and made a
 * first-class section. For a stats product, data credibility is the strongest
 * conversion lever, so it earns its own moment on the page.
 */
export async function DataProvenance() {
  const { t } = await getT()
  const points = [
    { icon: <SourceIcon />, title: t("home.provenance.p1Title"), body: t("home.provenance.p1Body") },
    { icon: <ScaleIcon />, title: t("home.provenance.p2Title"), body: t("home.provenance.p2Body") },
    { icon: <FreshIcon />, title: t("home.provenance.p3Title"), body: t("home.provenance.p3Body") },
  ]
  return (
    <section
      aria-label={t("home.provenance.eyebrow")}
      className="full-bleed relative py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-16">
          <Reveal direction="left">
            <div>
              <span className="gh-eyebrow">{t("home.provenance.eyebrow")}</span>
              <h2 className="mt-4 font-display text-3xl font-bold leading-[0.98] tracking-[-0.02em] text-balance text-ink-50 sm:text-4xl md:text-5xl">
                {t("home.provenance.title")}
              </h2>
              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-ink-200 sm:text-lg">
                {t("home.provenance.description")}
              </p>
            </div>
          </Reveal>

          <ul className="grid gap-4">
            {points.map((p, i) => (
              <Reveal key={p.title} direction="right" delay={0.06 * (i + 1)}>
                <li className="gh-card flex items-start gap-4 p-5 sm:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20">
                    {p.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-ink-50 sm:text-lg">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 text-pretty text-sm leading-relaxed text-ink-200">
                      {p.body}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
