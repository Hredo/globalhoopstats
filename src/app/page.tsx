import type { Metadata } from "next"
import Link from "next/link"
import { FadeIn } from "@/components/animations/fade-in"
import { Reveal, Stagger, StaggerItem } from "@/components/animations/reveal"
import { Parallax } from "@/components/animations/parallax"
import { SpotlightCard } from "@/components/animations/spotlight-card"
import { ScrollGallery } from "@/components/animations/scroll-gallery"
import { AppMockup } from "@/components/marketing/app-mockup"
import { CountUp } from "@/components/marketing/count-up"
import { Marquee } from "@/components/marketing/marquee"
import { JsonLd } from "@/components/marketing/json-ld"
import { TrustedBy } from "@/components/marketing/trusted-by"
import { FeatureShowcase } from "@/components/marketing/feature-showcase"
import { Testimonials } from "@/components/marketing/testimonials"
import { EmailSubscribe } from "@/components/marketing/email-subscribe"
import { Faq } from "@/components/marketing/faq"
import { MobileInstall } from "@/components/marketing/mobile-install"
import { getFaqData } from "@/components/marketing/faq-data"
// NOTE: PricingCta commented out until subscriptions are re-enabled.
// import { PricingCta } from "@/components/marketing/pricing-cta"
import { Eyebrow } from "@/components/ui/eyebrow"
import { SectionHeading } from "@/components/ui/section-heading"
import { ButtonLink } from "@/components/ui/button"
import { SITE } from "@/lib/site"
import { getGlobalLeagueCounts } from "@/lib/data/leagues"
import { getLocale, getT } from "@/lib/i18n/server"
import { getDictionary } from "@/lib/i18n/dictionaries"

const TICKER_LEFT = [
  { name: "Luka Dončić", team: "LAL · NBA", stat: "33.2 PPG" },
  { name: "Facundo Campazzo", team: "RMB · EuroLeague", stat: "7.9 APG" },
  { name: "Santi Aldama", team: "MEM · NBA", stat: "14.8 PPG" },
  { name: "Nikola Mirotić", team: "MIL · EuroLeague", stat: "17.5 PPG" },
  { name: "Willy Hernangómez", team: "RMB · EuroLeague", stat: "9.1 RPG" },
  { name: "Ante Tomić", team: "JOV · ACB", stat: "12.3 PPG" },
  { name: "Juan Núñez", team: "RMB · EuroLeague", stat: "7.1 APG" },
  { name: "Dario Brizuela", team: "FCB · ACB", stat: "15.4 PPG" },
]

const TICKER_RIGHT = [
  { name: "Dončić", stat: "33.2 / 9.1 / 8.4" },
  { name: "Aldama", stat: "14.8 / 7.2 / 2.6" },
  { name: "Mirotic", stat: "17.5 / 5.8 / 1.6" },
  { name: "Campazzo", stat: "11.8 / 3.2 / 7.9" },
  { name: "Núñez", stat: "9.4 / 2.8 / 7.1" },
  { name: "Brizuela", stat: "15.4 / 2.6 / 2.8" },
  { name: "Hernangómez", stat: "10.2 / 9.1 / 1.8" },
  { name: "Tomić", stat: "12.3 / 6.4 / 3.1" },
]

const STATS = [
  { v: 0, suffix: "", labelKey: "home.stats.leaguesLive", dynamic: "leagues" as const },
  { v: 0, suffix: "+", labelKey: "home.stats.playersIndexed", dynamic: "players" as const },
  { v: 24, suffix: "", labelKey: "home.stats.advancedMetrics" },
  { v: 2, suffix: "s", labelKey: "home.stats.toCompare", decimals: 0 },
]

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return {
    // Absolute title (skips the "· globalhoopstats" template) so the homepage —
    // the page that ranks for the brand query — leads with the brand name.
    title: {
      absolute: dict.home.metaTitle,
    },
    description: dict.metadata.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: `${SITE.name} — ${dict.metadata.tagline}`,
      description: dict.metadata.description,
      url: SITE.url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE.name} — ${dict.metadata.tagline}`,
      description: dict.metadata.description,
    },
  }
}

export default async function Home() {
  const counts = await getGlobalLeagueCounts()
  const { t, locale } = await getT()
  const stats = STATS.map((s) => {
    if ("dynamic" in s && s.dynamic === "players")
      return { ...s, v: counts.players }
    if ("dynamic" in s && s.dynamic === "leagues")
      return { ...s, v: counts.leagues }
    return s
  })
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: getFaqData(locale).map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  }

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: SITE.url,
    applicationCategory: "SportsApplication",
    applicationSubCategory: "Basketball Analytics",
    operatingSystem: "Web",
    description: SITE.description,
    offers: [
      {
        "@type": "Offer",
        name: "Public beta",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    ],
    featureList: [
      "Cross-league player comparison",
      "Pace and possession normalization",
      "Advanced metrics (PER, ORtg, DRtg, NetRtg, TS%)",
      "Player market valuations (transparent heuristic)",
      "Trade simulator with balanced scenarios",
      "League hubs with leaders",
      "AI advisor for scouting queries",
      "Exports to PDF, Excel and Word",
    ],
  }

  return (
    <div className="relative">
      <JsonLd data={[faqJsonLd, softwareJsonLd]} />

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="full-bleed relative isolate overflow-hidden pb-14 pt-12 sm:pb-24 sm:pt-20 md:pt-28">
        {/* background handled globally by the fixed court backdrop */}

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <FadeIn>
              <Eyebrow>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
                </span>
                {t("home.hero.eyebrow")}
              </Eyebrow>
            </FadeIn>

            <FadeIn delay={0.08} y={28}>
              <h1 className="mt-6 font-display text-[3.4rem] font-bold leading-[0.86] tracking-[-0.045em] text-ink-50 sm:text-[5rem] md:text-[6rem] xl:text-[6.75rem]">
                {t("home.hero.titleLine1")}
                <br />
                <span className="text-gradient-shimmer">
                  {t("home.hero.titleLine2")}
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.18} y={20}>
              <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-ink-200 sm:text-lg">
                {t("home.hero.description")}
              </p>
            </FadeIn>

            <FadeIn delay={0.28} y={16}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href="/ai-advisor" size="lg" arrow>
                  {t("home.hero.aiAdvisor")}
                </ButtonLink>
                <ButtonLink href="/compare" size="lg" variant="secondary">
                  {t("home.hero.comparePlayers")}
                </ButtonLink>
                <ButtonLink href="/players" size="lg" variant="ghost">
                  {t("home.hero.browseDatabase")}
                </ButtonLink>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                {stats.map((s) => (
                  <div
                    key={s.labelKey}
                    className="border-l-2 border-brand-500/40 pl-4"
                  >
                    <dt className="font-display text-2xl font-bold tabular-nums text-ink-50 sm:text-3xl">
                      <CountUp
                        to={s.v}
                        suffix={s.suffix}
                        decimals={"decimals" in s ? s.decimals : 0}
                      />
                    </dt>
                    <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400 sm:text-[11px]">
                      {t(s.labelKey)}
                    </dd>
                  </div>
                ))}
              </dl>
            </FadeIn>
          </div>

          <FadeIn delay={0.2} className="relative">
            <Parallax speed={24}>
              <div
                aria-hidden
                className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/25 via-transparent to-league-euro-600/20 blur-2xl"
              />
              <AppMockup />
            </Parallax>
          </FadeIn>
        </div>
        </div>
      </section>

      {/* ── TICKER ─────────────────────────────────────────────── */}
      <section
        aria-label={t("home.ticker.topPerformers")}
        className="full-bleed relative hairline-t hairline-b bg-surface-0/40 py-3.5"
      >
        <Marquee duration={55} className="text-sm">
          {TICKER_LEFT.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300 sm:text-xs"
            >
              <span className="h-1 w-1 rounded-full bg-brand-400" />
              <span className="text-ink-100">{t.name}</span>
              <span className="text-ink-500">{t.team}</span>
              <span className="text-brand-300">{t.stat}</span>
            </div>
          ))}
        </Marquee>
        <Marquee duration={70} reverse className="mt-2.5 text-sm">
          {TICKER_RIGHT.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300 sm:text-xs"
            >
              <span className="h-1 w-1 rounded-full bg-ink-400" />
              <span className="text-ink-100">{t.name}</span>
              <span className="text-ink-500">PTS · REB · AST</span>
              <span className="text-ink-200">{t.stat}</span>
            </div>
          ))}
        </Marquee>
      </section>

      <MobileInstall />

      <TrustedBy />

      {/* ── BENTO — inside the console ─────────────────────────── */}
      <section id="product" className="relative hairline-t py-20 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow={t("home.bento.eyebrow")}
            title={
              <>
                {t("home.bento.titleA")}{" "}
                <span className="text-gradient-brand">
                  {t("home.bento.titleB")}
                </span>
              </>
            }
            description={t("home.bento.description")}
          />
        </Reveal>

        <Stagger className="mt-12 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-6 md:auto-rows-[minmax(170px,1fr)]">
          <StaggerItem className="md:col-span-4 md:row-span-2">
            <BentoCard
              href="/compare"
              kicker={t("home.bento.compareKicker")}
              title={t("home.bento.compareTitle")}
              body={t("home.bento.compareBody")}
              big
            >
              <CompareGlyph />
            </BentoCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <BentoCard
              kicker={t("home.bento.metricsKicker")}
              title={t("home.bento.metricsTitle")}
              body={t("home.bento.metricsBody")}
            />
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <BentoCard
              href="/ai-advisor"
              kicker={t("home.bento.aiKicker")}
              title={t("home.bento.aiTitle")}
              body={t("home.bento.aiBody")}
              beta
            />
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <BentoCard
              href="/leagues"
              kicker={t("home.bento.coverageKicker")}
              title={t("home.bento.coverageTitle")}
              body={t("home.bento.coverageBody")}
            />
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <BentoCard
              kicker={t("home.bento.exportKicker")}
              title={t("home.bento.exportTitle")}
              body={t("home.bento.exportBody")}
            />
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <BentoCard
              href="/market/trade"
              kicker={t("home.bento.tradeKicker")}
              title={t("home.bento.tradeTitle")}
              body={t("home.bento.tradeBody")}
            />
          </StaggerItem>
        </Stagger>
      </section>

      {/* ── PINNED HORIZONTAL SCROLL GALLERY ──────────────────── */}
      <section aria-label={t("home.gallery.aria")} className="relative">
        <ScrollGallery />
      </section>

      <FeatureShowcase />

      <Testimonials />

      <EmailSubscribe />

      <section
        aria-labelledby="faq-heading"
        className="relative hairline-t py-20 sm:py-28"
      >
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow={t("home.faq.eyebrow")}
            title={t("home.faq.title")}
            description={t("home.faq.description")}
          />
        </Reveal>
        <div id="faq-heading" className="mt-12">
          <Faq />
        </div>
      </section>

      {/* NOTE: PricingCta commented out until subscriptions are re-enabled. */}
      {/* <PricingCta /> */}

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="relative my-16 sm:my-24">
        <Reveal>
          <div className="gh-bezel gh-sheen overflow-hidden">
            <div className="gh-bezel-inner relative overflow-hidden bg-gradient-to-br from-court-800/70 via-surface-1 to-surface-0 p-7 sm:p-12 md:p-16">
              <div
                aria-hidden
                className="absolute -left-24 -top-24 h-72 w-72 animate-aurora rounded-full bg-brand-500/30 blur-3xl"
              />
              <div
                aria-hidden
                className="absolute -bottom-28 right-[-6%] h-72 w-72 animate-breathe rounded-full bg-ember-500/20 blur-3xl"
              />
              <div aria-hidden className="absolute inset-0 bg-hatch opacity-50" />
              <div className="relative grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
                <div>
                  <Eyebrow>{t("home.cta.eyebrow")}</Eyebrow>
                  <h2 className="mt-5 font-display text-3xl font-bold leading-[0.96] tracking-[-0.03em] text-balance sm:text-4xl md:text-[3.25rem]">
                    {t("home.cta.titleA")}{" "}
                    <span className="text-gradient-brand">
                      {t("home.cta.titleB")}
                    </span>
                  </h2>
                  <p className="mt-4 max-w-md text-pretty text-base text-ink-200 sm:text-lg">
                    {t("home.cta.description")}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
                  <ButtonLink href="/compare" size="lg" arrow>
                    {t("home.hero.comparePlayers")}
                  </ButtonLink>
                  <ButtonLink href="/players" size="lg" variant="secondary">
                    {t("home.hero.browseDatabase")}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

/* ── Bento card ───────────────────────────────────────────────── */
async function BentoCard({
  kicker,
  title,
  body,
  href,
  // NOTE: pro prop kept for when Pro badge is re-enabled.
  // pro,
  beta,
  big,
  children,
}: {
  kicker: string
  title: string
  body: string
  href?: string
  // NOTE: pro prop kept for when Pro badge is re-enabled.
  // pro?: boolean
  beta?: boolean
  big?: boolean
  children?: React.ReactNode
}) {
  const { t } = await getT()
  return (
    <SpotlightCard className="gh-card gh-card-interactive group relative flex h-full flex-col overflow-hidden p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="gh-eyebrow">{kicker}</span>
        {/* NOTE: Pro badge kept for when Pro is re-enabled. */}
        {/* {pro ? ( */}
        {/*   <span className="rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-300"> */}
        {/*     Pro */}
        {/*   </span> */}
        {/* ) : null} */}
        {beta ? (
          <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            Beta
          </span>
        ) : null}
      </div>
      <h3
        className={
          big
            ? "mt-5 font-display text-2xl font-bold tracking-[-0.02em] text-ink-50 sm:text-3xl md:text-4xl"
            : "mt-5 font-display text-xl font-bold tracking-[-0.01em] text-ink-50 sm:text-2xl"
        }
      >
        {title}
      </h3>
      <p
        className={
          big
            ? "mt-3 max-w-md text-pretty text-sm leading-relaxed text-ink-200 sm:text-base"
            : "mt-2 text-pretty text-sm leading-relaxed text-ink-200"
        }
      >
        {body}
      </p>
      {children ? <div className="mt-auto pt-6">{children}</div> : null}
      {href ? (
        <span className="mt-auto inline-flex items-center gap-1.5 pt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-brand-300">
          {t("common.explore")}
          <svg
            className="h-3.5 w-3.5 transition-transform duration-300 ease-fluid group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </span>
      ) : null}
      {href ? (
        <Link href={href} className="absolute inset-0" aria-label={title} />
      ) : null}
    </SpotlightCard>
  )
}

/* a small abstract "compare" glyph for the big bento card */
function CompareGlyph() {
  const rows = [
    { l: "PPG", a: 86, b: 64 },
    { l: "RPG", a: 48, b: 72 },
    { l: "APG", a: 70, b: 90 },
    { l: "TS%", a: 78, b: 66 },
  ]
  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.l} className="flex items-center gap-3">
          <span className="w-9 shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
            {r.l}
          </span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <span
              className="h-full rounded-l-full bg-brand-500/80"
              style={{ width: `${r.a / 2}%` }}
            />
            <span
              className="h-full rounded-r-full bg-accent-cyan/70"
              style={{ width: `${r.b / 2}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
